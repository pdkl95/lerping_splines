(function() {
  var Bezier, Color, Curve, LERP, LERPingSplines, MatrixSpline, MatrixSplineSegment, Point, Spline, TAU, Vec2, clone,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  Color = (function() {
    function Color() {}

    Color.hex2rgb = function(h) {
      var arr, l, len, results, value;
      arr = h.length === 4 ? [h[1] + h[1], h[2] + h[2], h[3] + h[3]] : h.length === 7 ? [h[1] + h[2], h[3] + h[4], h[5] + h[6]] : raise("string '" + h + "' is not in '#RGB' or '#RRGGBB' format");
      results = [];
      for (l = 0, len = arr.length; l < len; l++) {
        value = arr[l];
        results.push(parseInt(value, 16) / 255);
      }
      return results;
    };

    Color.rgb2hex = function(r, g, b) {
      return Color.rgbarr2hex([r, g, b]);
    };

    Color.rgbarr2hex = function(arr) {
      var value;
      return "#" + ((function() {
        var l, len, results;
        results = [];
        for (l = 0, len = arr.length; l < len; l++) {
          value = arr[l];
          results.push(parseInt(255 * value, 10).toString(16).padStart(2, '0'));
        }
        return results;
      })()).join('');
    };

    Color.rgb2hsv = function(r, g, b) {
      var d, h, max, min, s, v;
      max = Math.max(r, g, b);
      min = Math.min(r, g, b);
      v = max;
      d = max - min;
      s = (max === 0 ? 0 : d / max);
      if (max === min) {
        h = 0;
      } else {
        h = (function() {
          switch (max) {
            case r:
              return (g - b) / d + (g < b ? 6 : 0);
            case g:
              return (b - r) / d + 2;
            case b:
              return (r - g) / d + 4;
          }
        })();
        h /= 6;
      }
      return [h, s, v];
    };

    Color.hsv2rgb = function(h, s, v) {
      var f, i, p, q, t;
      i = Math.floor(h * 6);
      f = h * 6 - i;
      p = v * (1 - s);
      q = v * (1 - f * s);
      t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0:
          return [v, t, p];
        case 1:
          return [q, v, p];
        case 2:
          return [p, v, t];
        case 3:
          return [p, q, v];
        case 4:
          return [t, p, v];
        case 5:
          return [v, p, q];
      }
    };

    return Color;

  })();

  Curve = (function() {
    function Curve() {
      this.update_at = bind(this.update_at, this);
      this.points = [];
      this.enabled_points = 0;
      this.ui_enabled = true;
      this.pen_label = 'P';
      this.pen_label_metrics = APP.graph_ctx.measureText(this.pen_label);
      this.pen_label_width = this.pen_label_metrics.width;
      this.pen_label_height = LERPingSplines.pen_label_height;
      this.pen_label_offset = {
        x: this.pen_label_width / 2,
        y: this.pen_label_height / 2
      };
      this.pen_label_offset_length = Vec2.magnitude(this.pen_label_offset);
    }

    Curve.prototype.reset = function() {
      return this.reset_points();
    };

    Curve.prototype.disable_ui = function() {
      return this.ui_enabled = false;
    };

    Curve.prototype.min_points = function() {
      return this.constructor.min_points;
    };

    Curve.prototype.max_points = function() {
      return this.constructor.max_points;
    };

    Curve.prototype.each_point = function*(include_first) {
      var first, l, len, len1, o, order, p, ref;
      if (include_first == null) {
        include_first = true;
      }
      first = true;
      ref = this.points;
      for (l = 0, len = ref.length; l < len; l++) {
        order = ref[l];
        for (o = 0, len1 = order.length; o < len1; o++) {
          p = order[o];
          if (first) {
            first = false;
            if (include_first) {
              yield p;
            }
          } else {
            yield p;
          }
        }
      }
    };

    Curve.prototype.add_lerps = function() {
      var j, l, lerp, order, prev, prev_order, ref, results;
      results = [];
      for (order = l = 1, ref = this.max_points(); 1 <= ref ? l <= ref : l >= ref; order = 1 <= ref ? ++l : --l) {
        this.points[order] = [];
        prev_order = order - 1;
        prev = this.points[prev_order];
        results.push((function() {
          var o, ref1, results1;
          results1 = [];
          for (j = o = 0, ref1 = this.max_points() - order; 0 <= ref1 ? o <= ref1 : o >= ref1; j = 0 <= ref1 ? ++o : --o) {
            if (!((prev[j] != null) && (prev[j + 1] != null))) {
              break;
            }
            lerp = new LERP(order, prev[j], prev[j + 1]);
            this.points[order][j] = lerp;
            results1.push(this.points[order][j].generate_label(order, j));
          }
          return results1;
        }).call(this));
      }
      return results;
    };

    Curve.prototype.set_points = function(points) {
      var l, len, p;
      for (l = 0, len = points.length; l < len; l++) {
        p = points[l];
        p.enabled = true;
        this.enabled_points += 1;
      }
      this.points[0] = points;
      this.first_point = this.points[0][0];
      this.last_point = this.points[0][this.points[0].length - 1];
      this.add_lerps();
      this.setup_label();
      return this.setup_pen();
    };

    Curve.prototype.reset_points = function() {
      var p, ref, results;
      ref = this.each_point();
      results = [];
      for (p of ref) {
        results.push(p.reset());
      }
      return results;
    };

    Curve.prototype.find_point = function(x, y) {
      var p, ref;
      ref = this.each_point();
      for (p of ref) {
        if (p != null ? p.contains(x, y) : void 0) {
          return p;
        }
      }
      return null;
    };

    Curve.prototype.setup_pen = function() {
      return this.pen = this.find_pen();
    };

    Curve.prototype.setup_label = function() {
      return this.label = this.first_point.label + "~" + this.last_point.label;
    };

    Curve.prototype.update_enabled_points = function() {
      var i;
      if (this.ui_enabled) {
        if (this.enabled_points < this.max_points()) {
          APP.add_point_btn.disabled = false;
        } else {
          APP.add_point_btn.disabled = true;
        }
        if (this.enabled_points > this.min_points()) {
          APP.remove_point_btn.disabled = false;
        } else {
          APP.remove_point_btn.disabled = true;
        }
        APP.num_points.textContent = "" + this.enabled_points;
      }
      this.update();
      this.first_point = this.points[0][0];
      i = this.points[0].length - 1;
      while (i > 0 && !this.points[0][i].enabled) {
        i--;
      }
      this.last_point = this.points[0][i];
      this.setup_label();
      this.setup_pen();
      return APP.update_algorithm();
    };

    Curve.prototype.order_up_rebalance = function() {};

    Curve.prototype.enable_point = function(rebalance_points) {
      var p;
      if (this.enabled_points >= this.max_points()) {
        return;
      }
      p = this.points[0][this.enabled_points];
      if (rebalance_points && APP.option.rebalance_points_on_order_up.value && APP.bezier_mode) {
        this.order_up_rebalance();
      }
      p.enabled = true;
      this.enabled_points += 1;
      this.update_enabled_points();
      return p;
    };

    Curve.prototype.enable_point_at = function(x, y) {
      var p;
      p = this.enable_point(false);
      p.x = x * APP.graph_width;
      p.y = y * APP.graph_height;
      return p;
    };

    Curve.prototype.compute_lower_order_curve = function() {};

    Curve.prototype.disable_point = function() {
      var p;
      if (this.enabled_points <= this.min_points()) {
        return;
      }
      if (this.enabled_points > 3 && APP.option.rebalance_points_on_order_down.value && APP.bezier_mode) {
        this.compute_lower_order_curve();
      }
      this.enabled_points -= 1;
      p = this.points[0][this.enabled_points];
      p.enabled = false;
      return this.update_enabled_points();
    };

    Curve.prototype.update_at = function(t) {
      var l, len, order, p, ref, results;
      ref = this.points;
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        order = ref[l];
        results.push((function() {
          var len1, o, results1;
          results1 = [];
          for (o = 0, len1 = order.length; o < len1; o++) {
            p = order[o];
            results1.push(p.update(t));
          }
          return results1;
        })());
      }
      return results;
    };

    Curve.prototype.update = function() {
      return this.update_at(APP.t);
    };

    Curve.prototype.find_pen = function() {
      var i, l, p, ref;
      for (i = l = ref = this.max_points() - 1; ref <= 1 ? l <= 1 : l >= 1; i = ref <= 1 ? ++l : --l) {
        p = this.points[i][0];
        if (p != null ? p.enabled : void 0) {
          break;
        }
      }
      if (!p) {
        APP.debug("missing pen");
      }
      return p;
    };

    Curve.prototype.draw_curve = function() {
      var ctx, p, start, t;
      if (!((this.points != null) && (this.points[0] != null))) {
        return;
      }
      start = this.points[0][0];
      p = this.find_pen();
      ctx = APP.graph_ctx;
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      t = 0.0;
      this.update_at(t);
      ctx.moveTo(p.position.x, p.position.y);
      while (t < 1.0) {
        t += 0.02;
        this.update_at(t);
        ctx.lineTo(p.position.x, p.position.y);
      }
      return ctx.stroke();
    };

    Curve.prototype.draw = function() {
      var l, len, len1, len2, len3, o, order, p, ref, ref1, ref2, results, u, w;
      if (!((this.points != null) && (this.points[0] != null))) {
        return;
      }
      ref = this.points;
      for (l = 0, len = ref.length; l < len; l++) {
        order = ref[l];
        for (o = 0, len1 = order.length; o < len1; o++) {
          p = order[o];
          if (p.order > 1) {
            p.draw();
          }
        }
      }
      ref1 = this.points[1];
      for (u = 0, len2 = ref1.length; u < len2; u++) {
        p = ref1[u];
        p.draw();
      }
      ref2 = this.points[0];
      results = [];
      for (w = 0, len3 = ref2.length; w < len3; w++) {
        p = ref2[w];
        results.push(p.draw());
      }
      return results;
    };

    Curve.prototype.get_normal = function() {
      var normal;
      if (this.pen == null) {
        return null;
      }
      this.update_at(APP.t - APP.t_step);
      this.pen.prev_position.x = this.pen.position.x;
      this.pen.prev_position.y = this.pen.position.y;
      this.update();
      if ((this.pen.prev_position.x != null) && (this.pen.prev_position.y != null)) {
        normal = {
          x: -(this.pen.position.y - this.pen.prev_position.y),
          y: this.pen.position.x - this.pen.prev_position.x
        };
        return Vec2.normalize(normal);
      } else {
        return null;
      }
    };

    Curve.prototype.draw_pen = function() {
      var angle, arrow, arrow_shaft, arrow_side1, arrow_side2, arrowtip, ctx, normal, plabel_offset, plx, ply;
      normal = this.get_normal();
      if (normal == null) {
        return;
      }
      if (normal != null) {
        arrow = Vec2.scale(normal, 22.0);
        arrowtip = Vec2.scale(normal, 15.0);
        arrow_shaft = Vec2.scale(normal, 65.0);
        angle = TAU / 8.0;
        arrow_side1 = Vec2.rotate(arrow, angle);
        arrow_side2 = Vec2.rotate(arrow, -angle);
        arrowtip.x += this.pen.position.x;
        arrowtip.y += this.pen.position.y;
        ctx = APP.graph_ctx;
        ctx.beginPath();
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow_shaft.x, arrowtip.y + arrow_shaft.y);
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow_side1.x, arrowtip.y + arrow_side1.y);
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow_side2.x, arrowtip.y + arrow_side2.y);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
        plabel_offset = Vec2.scale(Vec2.normalize(arrow_shaft), this.pen_label_offset_length + 3);
        plx = arrowtip.x + arrow_shaft.x + plabel_offset.x - this.pen_label_offset.x;
        ply = arrowtip.y + arrow_shaft.y + plabel_offset.y - this.pen_label_offset.y + this.pen_label_height;
        ctx.fillStyle = '#000';
        return ctx.fillText(this.pen_label, plx, ply);
      }
    };

    Curve.prototype.draw_tick_at = function(t, size) {
      var ctx, normal, point_a_x, point_a_y, point_b_x, point_b_y, t_save;
      if (this.pen == null) {
        return;
      }
      t_save = APP.t;
      APP.t = t;
      normal = this.get_normal();
      if (normal != null) {
        normal = Vec2.scale(normal, 3 + (4.0 * size));
        point_a_x = this.pen.position.x + normal.x;
        point_a_y = this.pen.position.y + normal.y;
        point_b_x = this.pen.position.x - normal.x;
        point_b_y = this.pen.position.y - normal.y;
        ctx = APP.graph_ctx;
        ctx.beginPath();
        ctx.moveTo(point_a_x, point_a_y);
        ctx.lineTo(point_b_x, point_b_y);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = size > 3 ? 2 : 1;
        ctx.stroke();
      }
      return APP.t = t_save;
    };

    Curve.prototype.draw_ticks = function() {
      this.pen = this.find_pen();
      this.draw_tick_at(0.0, 5);
      this.draw_tick_at(0.03125, 1);
      this.draw_tick_at(0.0625, 2);
      this.draw_tick_at(0.09375, 1);
      this.draw_tick_at(0.125, 3);
      this.draw_tick_at(0.15625, 1);
      this.draw_tick_at(0.1875, 2);
      this.draw_tick_at(0.21875, 1);
      this.draw_tick_at(0.25, 4);
      this.draw_tick_at(0.28125, 1);
      this.draw_tick_at(0.3125, 2);
      this.draw_tick_at(0.34375, 1);
      this.draw_tick_at(0.375, 3);
      this.draw_tick_at(0.40625, 1);
      this.draw_tick_at(0.4375, 2);
      this.draw_tick_at(0.46875, 1);
      this.draw_tick_at(0.5, 5);
      this.draw_tick_at(0.53125, 1);
      this.draw_tick_at(0.5625, 2);
      this.draw_tick_at(0.59375, 1);
      this.draw_tick_at(0.625, 3);
      this.draw_tick_at(0.65625, 1);
      this.draw_tick_at(0.6875, 2);
      this.draw_tick_at(0.71875, 1);
      this.draw_tick_at(0.75, 4);
      this.draw_tick_at(0.78125, 1);
      this.draw_tick_at(0.8125, 2);
      this.draw_tick_at(0.84375, 1);
      this.draw_tick_at(0.875, 3);
      this.draw_tick_at(0.90625, 1);
      this.draw_tick_at(0.9375, 2);
      this.draw_tick_at(0.96875, 1);
      return this.draw_tick_at(1.0, 5);
    };

    return Curve;

  })();

  Bezier = (function(superClass) {
    extend(Bezier, superClass);

    Bezier.min_points = 3;

    Bezier.max_points = 8;

    Bezier.initial_points = [[0.06, 0.82], [0.72, 0.18]];

    function Bezier() {
      Bezier.__super__.constructor.apply(this, arguments);
      this.alloc_points();
    }

    Bezier.prototype.t_min = function() {
      return 0.0;
    };

    Bezier.prototype.t_max = function() {
      return 1.0;
    };

    Bezier.prototype.add_segment = function() {
      return APP.assert_never_reached();
    };

    Bezier.prototype.sub_segment = function() {
      return APP.assert_never_reached();
    };

    Bezier.prototype.alloc_points = function() {
      var i, l, ref;
      this.points[0] = [];
      for (i = l = 0, ref = this.max_points(); 0 <= ref ? l <= ref : l >= ref; i = 0 <= ref ? ++l : --l) {
        this.points[0][i] = new Point();
        this.points[0][i].set_label(LERPingSplines.point_labels[i]);
      }
      return this.add_lerps();
    };

    Bezier.prototype.build = function() {
      var initial_points, l, len, margin, point, range;
      this.reset();
      initial_points = this.constructor.initial_points;
      margin = LERPingSplines.create_point_margin;
      range = 1.0 - (2.0 * margin);
      this.reset_points();
      for (l = 0, len = initial_points.length; l < len; l++) {
        point = initial_points[l];
        this.enable_point_at(point[0], point[1]);
      }
      this.update_enabled_points();
      return console.log('Initial points created!');
    };

    Bezier.prototype.order_up_rebalance = function() {
      var cur, cur_id, k, prev, prev_id, results, x, y;
      cur_id = this.enabled_points;
      prev_id = cur_id - 1;
      results = [];
      while (prev_id >= 0) {
        cur = this.points[0][cur_id];
        prev = this.points[0][prev_id];
        k = this.enabled_points;
        x = ((k - cur_id) / k) * cur.position.x + (cur_id / k) * prev.position.x;
        y = ((k - cur_id) / k) * cur.position.y + (cur_id / k) * prev.position.y;
        cur.move(x, y);
        cur_id--;
        results.push(prev_id--);
      }
      return results;
    };

    Bezier.prototype.compute_lower_order_curve = function() {
      var i, l, p, points, ref, results;
      points = this.points[0].map(function(point) {
        return {
          x: point.position.x,
          y: point.position.y
        };
      });
      /* copied from: https://pomax.github.io/bezierinfo/chapters/reordering/reorder.js */

    // Based on https://www.sirver.net/blog/2011/08/23/degree-reduction-of-bezier-curves/

    // TODO: FIXME: this is the same code as in the old codebase,
    //              and it does something odd to the either the
    //              first or last point... it starts to travel
    //              A LOT more than it looks like it should... O_o

    p = points,
    k = p.length,
    data = [],
    n = k-1;

    //if (k <= 3) return;

    // build M, which will be (k) rows by (k-1) columns
    for(let i=0; i<k; i++) {
      data[i] = (new Array(k - 1)).fill(0);
      if(i===0) { data[i][0] = 1; }
      else if(i===n) { data[i][i-1] = 1; }
      else {
        data[i][i-1] = i / k;
        data[i][i] = 1 - data[i][i-1];
      }
    }

    // Apply our matrix operations:
    const M = new Matrix(data);
    const Mt = M.transpose(M);
    const Mc = Mt.multiply(M);
    const Mi = Mc.invert();

    if (!Mi) {
      return console.error('MtM has no inverse?');
    }

    // And then we map our k-order list of coordinates
    // to an n-order list of coordinates, instead:
    const V = Mi.multiply(Mt);
    const x = new Matrix(points.map(p => [p.x]));
    const nx = V.multiply(x);
    const y = new Matrix(points.map(p => [p.y]));
    const ny = V.multiply(y);

    points = nx.data.map((x,i) => ({
      x: x[0],
      y: ny.data[i][0]
    }));;
      results = [];
      for (i = l = 0, ref = points.length; 0 <= ref ? l < ref : l > ref; i = 0 <= ref ? ++l : --l) {
        p = APP.clamp_to_canvas(points[i]);
        results.push(this.points[0][i].move(p.x, p.y));
      }
      return results;
    };

    Bezier.prototype.get_algorithm_text = function() {
      var l, label, len, lines, o, order, p, ref, ref1;
      lines = [];
      for (order = l = 0, ref = this.enabled_points - 1; 0 <= ref ? l <= ref : l >= ref; order = 0 <= ref ? ++l : --l) {
        if (order > 0) {
          lines.push("");
          lines.push("### Order " + order + " Bezier");
        } else {
          lines.push("### Points");
        }
        ref1 = this.points[order];
        for (o = 0, len = ref1.length; o < len; o++) {
          p = ref1[o];
          if (!p.enabled) {
            continue;
          }
          label = p === this.pen ? this.pen_label : p.get_label();
          if (APP.option.alt_algorithm_names.value) {
            switch (order) {
              case 0:
                lines.push(label + " = <" + (parseInt(p.position.x, 10)) + ", " + (parseInt(p.position.y, 10)) + ">");
                break;
              case 6:
                if (label.length < 4) {
                  lines.push(label + " = Lerp(" + (p.from.get_label()) + ", " + (p.to.get_label()) + ", t)");
                } else {
                  lines.push(label + " =");
                  lines.push("    Lerp(" + (p.from.get_label()) + ",");
                  lines.push("         " + (p.to.get_label()) + ", t)");
                }
                break;
              case 7:
                if (label.length < 4) {
                  lines.push(label + " = Lerp(" + (p.from.get_label()) + ",");
                } else {
                  lines.push(label + " =");
                  lines.push("    Lerp(" + (p.from.get_label()) + ",");
                }
                lines.push("         " + (p.to.get_label()) + ",");
                lines.push("         t)");
                break;
              default:
                lines.push(label + " = Lerp(" + (p.from.get_label()) + ", " + (p.to.get_label()) + ", t)");
            }
          } else {
            if (order > 0) {
              lines.push(label + " = Lerp(" + (p.from.get_label()) + ", " + (p.to.get_label()) + ", t)");
            } else {
              lines.push(label + " = <" + (parseInt(p.position.x, 10)) + ", " + (parseInt(p.position.y, 10)) + ">");
            }
          }
        }
      }
      return lines.join("\n");
    };

    return Bezier;

  })(Curve);

  Spline = (function(superClass) {
    extend(Spline, superClass);

    Spline.min_order = 1;

    Spline.max_order = 3;

    Spline.min_segments = 1;

    Spline.max_segments = 4;

    Spline.initial_points = [[0.06, 0.82], [0.15, 0.08], [0.72, 0.18], [0.88, 0.90], [0.43, 0.84]];

    function Spline() {
      this.update_at = bind(this.update_at, this);
      Spline.__super__.constructor.apply(this, arguments);
      this.order = -1;
      this.segment_count = -1;
      this.segment = [];
      this.alloc_points();
    }

    Spline.prototype.log = function() {
      console.log("/// Spline State: order=" + this.order + " segment_count=" + this.segment_count);
      console.log("                  points.length=" + this.points.length + " segment.length=" + this.segment.length);
      console.log('points');
      console.log(this.points);
      console.log('segments');
      console.log(this.segment);
      return console.log("\\\\\\ Spline State End");
    };

    Spline.prototype.reset = function() {
      Spline.__super__.reset.apply(this, arguments);
      this.order = -1;
      this.segment_count = -1;
      return this.segment = [];
    };

    Spline.prototype.t_min = function() {
      return 0.0;
    };

    Spline.prototype.t_max = function() {
      return this.segment_count - 1;
    };

    Spline.prototype.set_t_segment = function(value) {
      return this.t_segment = value;
    };

    Spline.prototype.current_segment = function() {
      if (APP.t_real === this.t_max()) {
        return this.segment[this.t_segment - 1];
      } else {
        return this.segment[this.t_segment];
      }
    };

    Spline.prototype.min_points = function() {
      return this.min_order() + 1;
    };

    Spline.prototype.max_points = function() {
      return (this.max_order() * this.max_segments()) + 1;
    };

    Spline.prototype.current_max_points = function() {
      return (this.order * this.segment_count) + 1;
    };

    Spline.prototype.min_segments = function() {
      return this.constructor.min_segments;
    };

    Spline.prototype.max_segments = function() {
      return this.constructor.max_segments;
    };

    Spline.prototype.min_order = function() {
      return this.constructor.min_order;
    };

    Spline.prototype.max_order = function() {
      return this.constructor.max_order;
    };

    Spline.prototype.enable_point = function(rebalance_points) {
      return APP.assert_never_reached();
    };

    Spline.prototype.disable_point = function(rebalance_points) {
      return APP.assert_never_reached();
    };

    Spline.prototype.alloc_points = function() {
      var i, l, prev, ref, results;
      this.points[0] = [];
      prev = null;
      results = [];
      for (i = l = 0, ref = this.max_points(); 0 <= ref ? l <= ref : l >= ref; i = 0 <= ref ? ++l : --l) {
        this.points[i] = new Point();
        if (prev != null) {
          prev.next = this.points[i];
          this.points[i].prev = prev;
        }
        results.push(prev = this.points[i]);
      }
      return results;
    };

    Spline.prototype.joining_points_for_order = function(order) {
      var l, len, n, p, points, ref, results;
      n = 0;
      points = [];
      ref = this.each_point();
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        p = ref[l];
        if (n < 2) {
          points.push(p.position);
          n = order;
        }
        results.push(n--);
      }
      return results;
    };

    Spline.prototype.new_segment = function() {
      var segment;
      segment = new Bezier();
      segment.disable_ui();
      return segment;
    };

    Spline.prototype.build = function(order, sc) {
      var cidx, end_idx, i, index, initial_points, j, l, label, len, next, o, p, pidx, point, pos, prev, ref, ref1, ref2, ref3, seg_points, start_idx, u, w;
      this.reset();
      this.order = order;
      this.segment_count = sc;
      initial_points = this.constructor.initial_points;
      if (initial_points == null) {
        initial_points = this.joining_points_for_order(this.order);
        console.log('initial_points', initial_points);
      }
      this.enabled_points = 0;
      if (!((this.min_segments() <= (ref = this.segment_count) && ref <= this.max_segments()))) {
        APP.fatal_error("bad @segment_count value: " + this.segment_count);
      }
      for (index = l = 0, ref1 = this.segment_count; 0 <= ref1 ? l <= ref1 : l >= ref1; index = 0 <= ref1 ? ++l : --l) {
        point = initial_points[index];
        pidx = index * this.order;
        this.points[pidx].enabled = true;
        this.enabled_points += 1;
        this.points[pidx].set_fract_position(point[0], point[1]);
        this.points[pidx].set_label(LERPingSplines.point_labels[index]);
        this.points[pidx].knot = true;
        if (index > 0) {
          for (j = o = 1, ref2 = this.order - 1; 1 <= ref2 ? o <= ref2 : o >= ref2; j = 1 <= ref2 ? ++o : --o) {
            cidx = pidx - this.order + j;
            prev = this.points[pidx - this.order];
            next = this.points[pidx];
            pos = Vec2.lerp(prev, next, j / this.order);
            this.points[cidx].enabled = true;
            this.enabled_points += 1;
            this.points[cidx].x = pos.x;
            this.points[cidx].y = pos.y;
            label = "" + prev.label + next.label + j;
            this.points[cidx].set_label(label);
            this.points[cidx].show_label = false;
            this.points[cidx].knot = false;
          }
        }
      }
      this.enabled_segments = 0;
      for (i = u = 0, ref3 = this.max_segments(); 0 <= ref3 ? u <= ref3 : u >= ref3; i = 0 <= ref3 ? ++u : --u) {
        start_idx = i * this.order;
        end_idx = start_idx + this.order + 1;
        if (end_idx >= this.current_max_points()) {
          break;
        }
        seg_points = this.points.slice(start_idx, end_idx);
        this.segment[i] = this.new_segment();
        this.segment[i].set_points(seg_points);
        this.segment[i].enabled = true;
        for (w = 0, len = seg_points.length; w < len; w++) {
          p = seg_points[w];
          if (!p.enabled) {
            this.segment[i].enabled = false;
            break;
          }
        }
        if (this.segment[i].enabled) {
          this.enabled_segments += 1;
        }
      }
      this.expected_points = 1;
      this.expected_points += this.segment_count;
      this.expected_points += this.segment_count * (this.order - 1);
      if (this.expected_points !== this.enabled_points) {
        APP.fatal_error("Wrong number of enabled points! Expected " + this.expected_points + ", have enabled " + this.enabled_points + " (order=" + this.order + " segment_count=" + this.segment_count);
      }
      return this.mirror_knot_neighbors();
    };

    Spline.prototype.mirror_knot_neighbors = function() {
      var avg_prev, delta, new_prev, p, ref, results;
      ref = this.each_knot();
      results = [];
      for (p of ref) {
        if (!((p.prev != null) && (p.next != null) && p.prev.enabled && p.next.enabled)) {
          continue;
        }
        delta = Vec2.sub(p.next, p);
        new_prev = Vec2.sub(p, delta);
        avg_prev = Vec2.lerp(p.prev, new_prev, 0.5);
        p.prev.x = avg_prev.x;
        p.prev.y = avg_prev.y;
        delta = Vec2.sub(p.prev, p);
        p.next.x = p.x - delta.x;
        results.push(p.next.y = p.y - delta.y);
      }
      return results;
    };

    Spline.prototype.each_knot = function*() {
      var first, l, len, p, ref, ref1, results, s;
      if (this.segment == null) {
        return;
      }
      first = true;
      ref = this.segment;
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        s = ref[l];
        ref1 = s.each_point(first);
        for (p of ref1) {
          if (p.knot) {
            yield p;
          }
        }
        results.push(first = false);
      }
      return results;
    };

    Spline.prototype.each_point = function*() {
      var first, l, len, p, ref, ref1, results, s;
      if (this.segment == null) {
        return;
      }
      first = true;
      ref = this.segment;
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        s = ref[l];
        ref1 = s.each_point(first);
        for (p of ref1) {
          yield p;
        }
        results.push(first = false);
      }
      return results;
    };

    Spline.prototype.find_point = function(x, y) {
      var l, len, p, ref, s;
      ref = this.segment;
      for (l = 0, len = ref.length; l < len; l++) {
        s = ref[l];
        p = s.find_point(x, y);
        if (p != null) {
          return p;
        }
      }
      return null;
    };

    Spline.prototype.call_on_each_segment = function(func_name) {
      var l, len, ref, results, s;
      s = this.current_segment();
      if (s != null) {
        this.pen = s.pen;
      }
      ref = this.segment;
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        s = ref[l];
        if (s != null ? s.enabled : void 0) {
          results.push(s[func_name]());
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Spline.prototype.update_at = function(t) {
      var s;
      s = this.current_segment();
      if (s != null) {
        return s.update_at(t);
      }
    };

    Spline.prototype.update = function() {
      return this.call_on_each_segment('update');
    };

    Spline.prototype.draw_curve = function() {
      return this.call_on_each_segment('draw_curve');
    };

    Spline.prototype.draw_ticks = function() {
      return this.call_on_each_segment('draw_ticks');
    };

    Spline.prototype.draw_pen = function() {
      var s;
      s = this.current_segment();
      if (s != null) {
        return s.draw_pen();
      }
    };

    Spline.prototype.draw = function() {
      return this.call_on_each_segment('draw');
    };

    Spline.prototype.get_algorithm_text = function() {
      return '';
    };

    return Spline;

  })(Curve);

  MatrixSplineSegment = (function() {
    function MatrixSplineSegment() {}

    MatrixSplineSegment.prototype.set_points = function(points) {
      return this.points = points;
    };

    MatrixSplineSegment.prototype.each_point = function*(include_first) {
      var first, l, len, p, ref;
      if (include_first == null) {
        include_first = true;
      }
      first = true;
      ref = this.points;
      for (l = 0, len = ref.length; l < len; l++) {
        p = ref[l];
        if (first) {
          first = false;
          if (include_first) {
            yield p;
          }
        } else {
          yield p;
        }
      }
    };

    MatrixSplineSegment.prototype.find_point = function(x, y) {
      var p, ref;
      ref = this.each_point();
      for (p of ref) {
        if (p != null ? p.contains(x.y) : void 0) {
          return p;
        }
      }
      return null;
    };

    MatrixSplineSegment.prototype.draw_handles = function() {
      var ctx;
      ctx = APP.graph_ctx;
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#666666';
      ctx.globalOpacity = 1.0;
      if ((this.points[0] != null) && (this.points[1] != null)) {
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.lineTo(this.points[1].x, this.points[1].y);
      }
      if ((this.points[2] != null) && (this.points[3] != null)) {
        ctx.moveTo(this.points[3].x, this.points[3].y);
        ctx.lineTo(this.points[2].x, this.points[2].y);
      }
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      return ctx.setLineDash([]);
    };

    MatrixSplineSegment.prototype.update_at = function(t) {
      var p, ref, results;
      ref = this.each_point();
      results = [];
      for (p of ref) {
        results.push(p.update(t));
      }
      return results;
    };

    MatrixSplineSegment.prototype.update = function() {
      return this.update_at(APP.t);
    };

    MatrixSplineSegment.prototype.draw = function() {
      var p, ref, results;
      this.draw_handles();
      ref = this.each_point();
      results = [];
      for (p of ref) {
        results.push(p.draw());
      }
      return results;
    };

    MatrixSplineSegment.prototype.get_cubic_derivative = function(t) {
      var a, b, c, d0x, d0y, d1x, d1y, d2x, d2y, mt;
      mt = 1 - t;
      a = mt * mt;
      b = 2 * mt * t;
      c = t * t;
      d0x = 3 * (this.points[1].x - this.points[0].x);
      d0y = 3 * (this.points[1].y - this.points[0].y);
      d1x = 3 * (this.points[2].x - this.points[1].x);
      d1y = 3 * (this.points[2].y - this.points[1].y);
      d2x = 3 * (this.points[3].x - this.points[2].x);
      d2y = 3 * (this.points[3].y - this.points[2].y);
      return {
        x: a * d0x + b * d1x + c * d2x,
        y: a * d0y + b * d1y + c * d2y
      };
    };

    MatrixSplineSegment.prototype.get_normal = function(t) {
      var d, m, q;
      d = this.get_cubic_derivative(t);
      m = Math.sqrt(d.x * d.x + d.y * d.y);
      d.x = d.x / m;
      d.y = d.y / m;
      q = Math.sqrt(d.x * d.x + d.y * d.y);
      return {
        x: -d.y / q,
        y: d.x / q
      };
    };

    return MatrixSplineSegment;

  })();

  MatrixSpline = (function(superClass) {
    extend(MatrixSpline, superClass);

    MatrixSpline.default_matrix = 'bezier';

    MatrixSpline.type = {
      bezier: {
        name: "Bezier",
        scale: 1.0,
        char_matrix: [[1, 0, 0, 0], [-3, 3, 0, 0], [3, -6, 3, 0], [-1, 3, -3, 1]],
        color: '#D5A9EF'
      },
      hermite: {
        name: "Hermite",
        scale: 1.0,
        char_matrix: [[1, 0, 0, 0], [0, 0, 1, 0], [-3, 3, -2, -1], [2, -2, 1, 1]],
        color: '#83A2D6'
      },
      catmullrom: {
        name: "Catmull-Rom",
        scale: 1.0 / 2.0,
        char_matrix: [[0, 2, 0, 0], [-1, 0, 1, 0], [2, -5, 4, -1], [-1, 3, -3, 1]],
        color: '#94D683'
      },
      bspline: {
        name: "B-Spline",
        scale: 1.0 / 6.0,
        char_matrix: [[1, 4, 1, 0], [-3, 0, 3, 0], [3, -6, 3, 0], [-1, 3, -3, 1]],
        color: '#E3A445'
      }
    };

    function MatrixSpline() {
      this.update_at = bind(this.update_at, this);
      this.render = {
        type_name: null,
        name: null,
        scale: null,
        char_matrix: null,
        color: null
      };
      this.use_matrix_type(this.constructor.default_matrix);
      this.t_matrix = new Matrix([[0, 0, 0, 0]]);
      MatrixSpline.__super__.constructor.apply(this, arguments);
    }

    MatrixSpline.prototype.use_matrix_type = function(type_name) {
      this.render.type_name = this.type_name;
      this.render.name = this.constructor.type[type_name].name;
      this.render.scale = this.constructor.type[type_name].scale;
      this.render.char_matrix = new Matrix(this.constructor.type[type_name].char_matrix);
      return this.render.color = this.constructor.type[type_name].color;
    };

    MatrixSpline.prototype.find_pen = function() {
      var p;
      p = this.points[0];
      if (p != null ? p.enabled : void 0) {
        return p;
      } else {
        if (!p) {
          APP.debug("missing pen");
        }
        return null;
      }
    };

    MatrixSpline.prototype.new_segment = function() {
      return new MatrixSplineSegment(this);
    };

    MatrixSpline.prototype.each_point = function*(include_first) {
      var first, l, len, p, ref, ref1, s;
      if (include_first == null) {
        include_first = true;
      }
      if (this.segment == null) {
        return;
      }
      first = true;
      ref = this.segment;
      for (l = 0, len = ref.length; l < len; l++) {
        s = ref[l];
        ref1 = s.each_point(first);
        for (p of ref1) {
          if (first) {
            first = false;
            if (include_first) {
              yield p;
            }
          } else {
            yield p;
          }
        }
      }
    };

    MatrixSpline.prototype.find_point = function(x, y) {
      var p, ref;
      ref = this.each_point();
      for (p of ref) {
        if (p != null ? p.contains(x, y) : void 0) {
          return p;
        }
      }
      return null;
    };

    MatrixSpline.prototype.set_t_matrix = function(t) {
      this.t_matrix.set(0, 0, 1);
      this.t_matrix.set(0, 1, t);
      this.t_matrix.set(0, 2, t * t);
      return this.t_matrix.set(0, 3, t * t * t);
    };

    MatrixSpline.prototype.eval_segment_at = function(t_segment, t) {
      var i, l, m, p, total_x, total_y, value;
      this.set_t_matrix(t);
      m = this.t_matrix.multiply(this.render.char_matrix);
      p = this.segment[t_segment].points;
      total_x = 0.0;
      total_y = 0.0;
      for (i = l = 0; l <= 3; i = ++l) {
        value = m.get(0, i);
        total_x += value * p[i].x;
        total_y += value * p[i].y;
      }
      return {
        x: total_x * this.render.scale,
        y: total_y * this.render.scale
      };
    };

    MatrixSpline.prototype.eval_current_segment_at = function(t) {
      return this.eval_segment_at(this.current_segment, t);
    };

    MatrixSpline.prototype.separate_t = function(t) {
      var t_fract, t_segment;
      if (t == null) {
        t = APP.t_real;
      }
      t_segment = Math.floor(t);
      t_fract = t - t_segment;
      if (t >= this.enabled_segments) {
        t_segment = this.enabled_segments - 1;
        t_fract = 1.0;
      }
      return [t_segment, t_fract];
    };

    MatrixSpline.prototype.current_segment = function() {
      var ref, t_fract, t_segment;
      ref = this.separate_t(APP.t_real), t_segment = ref[0], t_fract = ref[1];
      return this.segment[t_segment];
    };

    MatrixSpline.prototype.eval_at = function(t) {
      var ref, t_fract, t_segment;
      ref = this.separate_t(t), t_segment = ref[0], t_fract = ref[1];
      return this.eval_segment_at(t_segment, t_fract);
    };

    MatrixSpline.prototype.eval_current = function() {
      return this.eval_at(APP.t_real);
    };

    MatrixSpline.prototype.update_at = function(t) {
      var l, len, ref, results, s;
      ref = this.segment;
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        s = ref[l];
        results.push(s.update(t));
      }
      return results;
    };

    MatrixSpline.prototype.update = function() {
      return this.update_at(APP.t);
    };

    MatrixSpline.prototype.draw = function() {
      var l, len, ref, results, s;
      ref = this.segment;
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        s = ref[l];
        results.push(s.draw());
      }
      return results;
    };

    MatrixSpline.prototype.draw_curve = function(override_color) {
      var ctx, max_t, position, t;
      if (override_color == null) {
        override_color = null;
      }
      if (this.points == null) {
        return;
      }
      ctx = APP.graph_ctx;
      ctx.beginPath();
      ctx.strokeStyle = this.render.color;
      ctx.lineWidth = 3;
      t = 0.0;
      max_t = this.segment_count + 1;
      position = this.eval_at(t);
      ctx.moveTo(position.x, position.y);
      while (t < max_t) {
        t += 0.02;
        position = this.eval_at(t);
        ctx.lineTo(position.x, position.y);
      }
      return ctx.stroke();
    };

    MatrixSpline.prototype.get_normal = function(t) {
      if (t == null) {
        t = APP.t;
      }
      return this.current_segment().get_normal(t);
    };

    MatrixSpline.prototype.draw_ticks = function() {};

    MatrixSpline.prototype.draw_pen = function() {
      var angle, arrow, arrow_shaft, arrow_side1, arrow_side2, arrowtip, ctx, normal, pen_position, plabel_offset, plx, ply;
      normal = this.get_normal();
      if (normal != null) {
        pen_position = this.eval_current();
        arrow = Vec2.scale(normal, 22.0);
        arrowtip = Vec2.scale(normal, 15.0);
        arrow_shaft = Vec2.scale(normal, 65.0);
        angle = TAU / 8.0;
        arrow_side1 = Vec2.rotate(arrow, angle);
        arrow_side2 = Vec2.rotate(arrow, -angle);
        arrowtip.x += pen_position.x;
        arrowtip.y += pen_position.y;
        ctx = APP.graph_ctx;
        ctx.beginPath();
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow_shaft.x, arrowtip.y + arrow_shaft.y);
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow_side1.x, arrowtip.y + arrow_side1.y);
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow_side2.x, arrowtip.y + arrow_side2.y);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
        plabel_offset = Vec2.scale(Vec2.normalize(arrow_shaft), this.pen_label_offset_length + 3);
        plx = arrowtip.x + arrow_shaft.x + plabel_offset.x - this.pen_label_offset.x;
        ply = arrowtip.y + arrow_shaft.y + plabel_offset.y - this.pen_label_offset.y + this.pen_label_height;
        ctx.fillStyle = '#000';
        return ctx.fillText(this.pen_label, plx, ply);
      }
    };

    return MatrixSpline;

  })(Spline);

  window.APP = null;

  TAU = 2 * Math.PI;

  LERPingSplines = (function() {
    LERPingSplines.create_point_margin = 0.12;

    LERPingSplines.point_radius = 5;

    LERPingSplines.point_move_margin = 24;

    LERPingSplines.point_label_flip_margin = 32;

    LERPingSplines.point_labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    LERPingSplines.point_label_height = 22;

    LERPingSplines.pen_label_height = 22;

    LERPingSplines.mouseover_point_radius_boost = 6;

    LERPingSplines.storage_prefix = 'lerp_spline';

    function LERPingSplines(context) {
      this.context = context;
      this.schedule_first_frame = bind(this.schedule_first_frame, this);
      this.first_update_callback = bind(this.first_update_callback, this);
      this.schedule_next_frame = bind(this.schedule_next_frame, this);
      this.update_callback = bind(this.update_callback, this);
      this.update = bind(this.update, this);
      this.update_at = bind(this.update_at, this);
      this.redraw_ui = bind(this.redraw_ui, this);
      this.draw = bind(this.draw, this);
      this.on_keyup = bind(this.on_keyup, this);
      this.on_keydown = bind(this.on_keydown, this);
      this.on_mouseup = bind(this.on_mouseup, this);
      this.on_mouseup_canvas = bind(this.on_mouseup_canvas, this);
      this.on_mouseup_tslider = bind(this.on_mouseup_tslider, this);
      this.on_mousedown = bind(this.on_mousedown, this);
      this.on_tslider_mousedown = bind(this.on_tslider_mousedown, this);
      this.on_mousemove = bind(this.on_mousemove, this);
      this.on_mousemove_canvas = bind(this.on_mousemove_canvas, this);
      this.on_mousemove_tslider = bind(this.on_mousemove_tslider, this);
      this.on_hide_algorithm_false = bind(this.on_hide_algorithm_false, this);
      this.on_show_algorithm_true = bind(this.on_show_algorithm_true, this);
      this.stop = bind(this.stop, this);
      this.start = bind(this.start, this);
      this.on_tslide_btn_max_click = bind(this.on_tslide_btn_max_click, this);
      this.on_tslide_btn_min_click = bind(this.on_tslide_btn_min_click, this);
      this.on_tslider_bg_click = bind(this.on_tslider_bg_click, this);
      this.on_btn_play_pause_click = bind(this.on_btn_play_pause_click, this);
      this.on_sub_segment_btn_click = bind(this.on_sub_segment_btn_click, this);
      this.on_add_segment_btn_click = bind(this.on_add_segment_btn_click, this);
      this.on_sub_order_btn_click = bind(this.on_sub_order_btn_click, this);
      this.on_add_order_btn_click = bind(this.on_add_order_btn_click, this);
      this.on_remove_point_btn_click = bind(this.on_remove_point_btn_click, this);
      this.on_add_point_btn_click = bind(this.on_add_point_btn_click, this);
      this.on_alt_algorithm_names_change = bind(this.on_alt_algorithm_names_change, this);
      this.on_pen_label_change = bind(this.on_pen_label_change, this);
      this.on_show_ticks_change = bind(this.on_show_ticks_change, this);
      this.on_show_tooltips_change = bind(this.on_show_tooltips_change, this);
      this.on_mode_change = bind(this.on_mode_change, this);
    }

    LERPingSplines.prototype.init = function() {
      var ref, ref1, ref2, ref3, ref4, ref5;
      console.log('Starting init()...');
      this.running = false;
      this.content_el = this.context.getElementById('content');
      this.show_tooltips = this.context.getElementById('show_tooltips');
      this.show_tooltips.addEventListener('change', this.on_show_tooltips_change);
      this.show_tooltips.checked = true;
      this.option = {
        connect_cubic_control_points: new UI.BoolOption('connect_cubic_control_points', true),
        show_ticks: new UI.BoolOption('show_ticks', false),
        show_pen_label: new UI.BoolOption('show_pen_label', true),
        show_algorithm: new UI.BoolOption('show_algorithm', true),
        alt_algorithm_names: new UI.BoolOption('alt_algorithm_names', true),
        rebalance_points_on_order_up: new UI.BoolOption('rebalance_points_on_order_up', false),
        rebalance_points_on_order_down: new UI.BoolOption('rebalance_points_on_order_down', false),
        show_tooltips: new UI.BoolOption('show_tooltips', true),
        mode: new UI.ChoiceOption('mode_choice', 'bezier')
      };
      this.option.show_ticks.register_callback({
        on_change: this.on_show_ticks_change
      });
      this.option.show_pen_label.register_callback({
        on_change: this.on_pen_label_change
      });
      this.option.alt_algorithm_names.register_callback({
        on_change: this.on_alt_algorithm_names_change
      });
      this.option.show_algorithm.register_callback({
        on_true: this.on_show_algorithm_true,
        on_false: this.on_show_algorithm_false
      });
      this.option.mode.register_callback({
        on_change: this.on_mode_change
      });
      this.bezier_mode = false;
      this.spline_mode = false;
      this.graph_wrapper = this.find_element('graph_wrapper');
      this.graph_canvas = this.find_element('graph');
      this.graph_ctx = this.graph_canvas.getContext('2d', {
        alpha: true
      });
      this.graph_ctx.font = "bold " + LERPingSplines.point_label_height + "px sans-serif";
      this.graph_width = this.graph_canvas.width;
      this.graph_height = this.graph_canvas.height;
      this.point_move_margin = {
        min_x: LERPingSplines.point_move_margin,
        min_y: LERPingSplines.point_move_margin,
        max_x: this.graph_width - LERPingSplines.point_move_margin,
        max_y: this.graph_height - LERPingSplines.point_move_margin
      };
      this.point_label_flip_margin = {
        min_x: LERPingSplines.point_label_flip_margin,
        min_y: LERPingSplines.point_label_flip_margin,
        max_x: this.graph_width - LERPingSplines.point_label_flip_margin,
        max_y: this.graph_height - LERPingSplines.point_label_flip_margin
      };
      this.tvar = this.context.getElementById('tvar');
      this.tslider_btn_min = this.find_element('tbox_slider_btn_min');
      this.tslider_btn_min.addEventListener('click', this.on_tslide_btn_min_click);
      this.tslider_btn_max = this.find_element('tbox_slider_btn_max');
      this.tslider_btn_max.addEventListener('click', this.on_tslide_btn_max_click);
      this.tslider_bg = this.find_element('tbox_slider');
      this.tslider_bg.addEventListener('click', this.on_tslider_bg_click);
      this.tslider = {
        handle: this.find_element('tbox_slider_handle'),
        min: 0,
        max: 264,
        drag_active: false
      };
      this.tslider.position = this.tslider.min;
      this.tslider.range = this.tslider.max - this.tslider.min;
      this.tslider.handle.addEventListener('mousedown', this.on_tslider_mousedown);
      this.btn_play_pause = this.find_element('button_play_pause');
      this.btn_play_pause.addEventListener('click', this.on_btn_play_pause_click);
      this.num_points = this.find_element('num_points');
      this.points_wrapper = this.find_element('points_wrapper');
      this.add_point_btn = this.find_element('add_point');
      if ((ref = this.add_point_btn) != null) {
        ref.addEventListener('click', this.on_add_point_btn_click);
      }
      this.remove_point_btn = this.find_element('remove_point');
      if ((ref1 = this.remove_point_btn) != null) {
        ref1.addEventListener('click', this.on_remove_point_btn_click);
      }
      this.num_order = this.find_element('num_order');
      this.order_wrapper = this.find_element('order_wrapper');
      this.add_order_btn = this.find_element('add_order');
      if ((ref2 = this.add_order_btn) != null) {
        ref2.addEventListener('click', this.on_add_order_btn_click);
      }
      this.sub_order_btn = this.find_element('sub_order');
      if ((ref3 = this.sub_order_btn) != null) {
        ref3.addEventListener('click', this.on_sub_order_btn_click);
      }
      this.num_segments = this.find_element('num_segments');
      this.segment_wrapper = this.find_element('segment_wrapper');
      this.add_segment_btn = this.find_element('add_segment');
      if ((ref4 = this.add_segment_btn) != null) {
        ref4.addEventListener('click', this.on_add_segment_btn_click);
      }
      this.sub_segment_btn = this.find_element('sub_segment');
      if ((ref5 = this.sub_segment_btn) != null) {
        ref5.addEventListener('click', this.on_sub_segment_btn_click);
      }
      this.algorithmbox = this.find_element('algorithmbox');
      this.algorithm_text = this.find_element('algorithm_text');
      this.bezier_curve = new Bezier();
      this.build_bezier();
      this.spline_order = 3;
      this.spline_segments = 3;
      this.spline_curve = new Spline();
      this.build_spline();
      this.matrix_spline_curve = new MatrixSpline();
      this.build_matrix_spline();
      this.reset_loop();
      this.option.mode.change();
      this.shift = false;
      this.context.addEventListener('keydown', this.on_keydown);
      this.context.addEventListener('keyup', this.on_keyup);
      this.context.addEventListener('mousemove', this.on_mousemove);
      this.context.addEventListener('mousedown', this.on_mousedown);
      this.context.addEventListener('mouseup', this.on_mouseup);
      console.log('init() completed!');
      this.update();
      return this.stop();
    };

    LERPingSplines.prototype.debug = function(msg_text) {
      var hdr, line, msg, timestamp;
      console.log(msg_text);
      if (this.debugbox == null) {
        this.debugbox = this.context.getElementById('debugbox');
        this.debugbox.classList.remove('hidden');
      }
      hdr = this.create_element('span', {
        "class": ['hdr']
      });
      msg = this.create_element('span', {
        "class": ['msg']
      });
      timestamp = new Date();
      hdr.textContent = timestamp.toISOString();
      msg.textContent = '' + msg_text;
      line = this.create_element('div', {
        "class": ['dbg_line']
      });
      line.appendChild(hdr);
      line.appendChild(msg);
      return this.debugbox.appendChild(line);
    };

    LERPingSplines.prototype.fatal_error = function(msg) {
      this.runhing = false;
      msg = "FATAL ERROR: " + msg;
      return this.debug(msg);
    };

    LERPingSplines.prototype.assert_never_reached = function() {
      return this.fatal_error("assert_never_reached() was reached");
    };

    LERPingSplines.prototype.create_element = function(tag_name, opt) {
      var el, klass, l, len, ref;
      if (opt == null) {
        opt = {};
      }
      el = this.context.createElement(tag_name);
      if (opt['class'] != null) {
        ref = opt['class'];
        for (l = 0, len = ref.length; l < len; l++) {
          klass = ref[l];
          el.classList.add(klass);
        }
      }
      return el;
    };

    LERPingSplines.prototype.find_element = function(id) {
      var el;
      el = this.context.getElementById(id);
      if (el == null) {
        this.debug("ERROR: missing element #" + id);
      }
      return el;
    };

    LERPingSplines.prototype.storage_key = function(key) {
      return this.constructor.storage_prefix + "-" + key;
    };

    LERPingSplines.prototype.storage_set = function(key, value, default_value) {
      if (default_value == null) {
        default_value = null;
      }
      if ((default_value != null) && (default_value === value)) {
        return this.storage_remove(key);
      } else {
        return localStorage.setItem(this.storage_key(key), value);
      }
    };

    LERPingSplines.prototype.storage_get = function(key) {
      return localStorage.getItem(this.storage_key(key));
    };

    LERPingSplines.prototype.storage_get_int = function(key) {
      return parseInt(this.storage_get(key));
    };

    LERPingSplines.prototype.storage_get_float = function(key) {
      return parseFloat(this.storage_get(key));
    };

    LERPingSplines.prototype.storage_remove = function(key) {
      return localStorage.removeItem(this.storage_key(key));
    };

    LERPingSplines.prototype.reset_loop = function() {
      this.t = 0;
      this.t_real = 0;
      this.t_step = 0.002;
      return this.set_tslider_position(this.tslider.min, false);
    };

    LERPingSplines.prototype.loop_start = function() {
      return this.loop_running = true;
    };

    LERPingSplines.prototype.loop_stop = function() {
      return this.loop_running = false;
    };

    LERPingSplines.prototype.build_bezier = function() {
      return this.bezier_curve.build();
    };

    LERPingSplines.prototype.build_spline = function() {
      this.spline_curve.build(this.spline_order, this.spline_segments);
      this.update_order();
      return this.update_segments();
    };

    LERPingSplines.prototype.build_matrix_spline = function() {
      this.matrix_spline_curve.build(3, this.spline_segments);
      return this.update_segments();
    };

    LERPingSplines.prototype.configure_for_bezier_mode = function() {
      console.log("configure for mode: bezier");
      this.bezier_mode = true;
      this.spline_mode = false;
      this.matrix_spline_mode = false;
      this.curve = this.bezier_curve;
      this.order_wrapper.classList.add('hidden');
      this.segment_wrapper.classList.add('hidden');
      this.points_wrapper.classList.remove('hidden');
      return this.update_and_draw();
    };

    LERPingSplines.prototype.configure_for_spline_mode = function() {
      console.log("configure for mode: spline");
      this.bezier_mode = false;
      this.spline_mode = true;
      this.matrix_spline_mode = false;
      this.curve = this.spline_curve;
      this.order_wrapper.classList.remove('hidden');
      this.segment_wrapper.classList.remove('hidden');
      this.points_wrapper.classList.add('hidden');
      return this.update_and_draw();
    };

    LERPingSplines.prototype.configure_for_matrix_spline_mode = function() {
      console.log("configure for mode: matrix spline");
      this.bezier_mode = false;
      this.spline_mode = false;
      this.matrix_spline_mode = true;
      this.curve = this.matrix_spline_curve;
      this.order_wrapper.classList.add('hidden');
      this.segment_wrapper.classList.remove('hidden');
      this.points_wrapper.classList.add('hidden');
      return this.update_and_draw();
    };

    LERPingSplines.prototype.change_mode = function(mode, update_opt) {
      if (update_opt == null) {
        update_opt = true;
      }
      if (update_opt) {
        this.option.mode.set(mode);
      }
      switch (mode) {
        case 'bezier':
          return this.configure_for_bezier_mode();
        case 'spline':
          return this.configure_for_spline_mode();
        case 'matrix_spline':
          return this.configure_for_matrix_spline_mode();
        default:
          return this.fatal_error("bad mode name \"" + mode + "\"");
      }
    };

    LERPingSplines.prototype.on_mode_change = function() {
      return this.change_mode(this.option.mode.get(), false);
    };

    LERPingSplines.prototype.on_show_tooltips_change = function(event) {
      if (this.show_tooltips.checked) {
        return this.content_el.classList.add('show_tt');
      } else {
        return this.content_el.classList.remove('show_tt');
      }
    };

    LERPingSplines.prototype.on_show_ticks_change = function() {
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_pen_label_change = function() {
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_alt_algorithm_names_change = function() {
      return this.update_algorithm();
    };

    LERPingSplines.prototype.on_add_point_btn_click = function(event, ui) {
      this.curve.enable_point(true);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_remove_point_btn_click = function(event, ui) {
      this.curve.disable_point();
      return this.update_and_draw();
    };

    LERPingSplines.prototype.update_order = function() {
      if (!this.spline_curve) {
        return;
      }
      if (this.spline_order < this.spline_curve.max_order()) {
        this.add_order_btn.disabled = false;
      } else {
        this.add_order_btn.disabled = true;
      }
      if (this.spline_order > this.spline_curve.min_order()) {
        this.sub_order_btn.disabled = false;
      } else {
        this.sub_order_btn.disabled = true;
      }
      return this.num_order.textContent = "" + this.spline_order;
    };

    LERPingSplines.prototype.on_add_order_btn_click = function(event, ui) {
      if (this.spline_order < this.spline_curve.max_order()) {
        this.spline_order += 1;
        this.build_spline();
      }
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_sub_order_btn_click = function(event, ui) {
      if (this.spline_order > this.spline_curve.min_order()) {
        this.spline_order -= 1;
        this.build_spline();
      }
      return this.update_and_draw();
    };

    LERPingSplines.prototype.update_segments = function() {
      if (!this.spline_curve) {
        return;
      }
      if (this.spline_segments < this.spline_curve.max_segments()) {
        this.add_segment_btn.disabled = false;
      } else {
        this.add_segment_btn.disabled = true;
      }
      if (this.spline_segments > this.spline_curve.min_segments()) {
        this.sub_segment_btn.disabled = false;
      } else {
        this.sub_segment_btn.disabled = true;
      }
      return this.num_segments.textContent = "" + (this.spline_segments - 1);
    };

    LERPingSplines.prototype.on_add_segment_btn_click = function(event, ui) {
      if (this.spline_segments < this.spline_curve.max_segments()) {
        this.spline_segments += 1;
        this.build_spline();
      }
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_sub_segment_btn_click = function(event, ui) {
      if (this.spline_segments > this.spline_curve.min_segments()) {
        this.spline_segments -= 1;
        this.build_spline();
      }
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_btn_play_pause_click = function(event, ui) {
      if (this.running) {
        return this.stop();
      } else {
        return this.start();
      }
    };

    LERPingSplines.prototype.set_tslider_position = function(x, update_t) {
      if (update_t == null) {
        update_t = true;
      }
      if (x < this.tslider.min) {
        x = this.tslider.min;
      }
      if (x > this.tslider.max) {
        x = this.tslider.max;
      }
      this.tslider.position = x;
      this.tslider.handle.style.left = x + "px";
      if (update_t) {
        return this.set_t_perc((x - this.tslider.min) / this.tslider.range);
      }
    };

    LERPingSplines.prototype.on_tslider_bg_click = function(event) {
      var cc, coord_x, slider_pos, t;
      cc = this.tslider_bg.getBoundingClientRect();
      coord_x = event.pageX - cc.left;
      coord_x -= window.scrollX;
      t = coord_x / cc.width;
      slider_pos = this.tslider.min + (t * (this.tslider.max - this.tslider.min));
      this.set_tslider_position(slider_pos);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_tslide_btn_min_click = function() {
      this.set_tslider_position(this.tslider.min);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_tslide_btn_max_click = function() {
      this.set_tslider_position(this.tslider.max);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.set_t = function(value) {
      var max;
      this.t_real = value;
      max = this.curve.t_max();
      while (this.t_real > max) {
        this.t_real -= max;
      }
      this.t_perc = (this.t_real - this.curve.t_min()) / max;
      this.t = this.t_real;
      if (this.t > 0) {
        if (this.spline_mode) {
          this.curve.set_t_segment(Math.floor(this.t_real));
          this.t = this.t_real - this.curve.t_segment;
        }
      }
      this.tvar.textContent = this.t_real.toFixed(2);
      if (this.t_real === this.curve.t_min()) {
        this.tslider_btn_min.disabled = true;
      } else {
        this.tslider_btn_min.disabled = false;
      }
      if (this.t_real >= this.curve.t_max()) {
        this.t = 1.0;
        return this.tslider_btn_max.disabled = true;
      } else {
        return this.tslider_btn_max.disabled = false;
      }
    };

    LERPingSplines.prototype.set_t_perc = function(value) {
      var min;
      min = this.curve.t_min();
      return this.set_t((value * (this.curve.t_max() - min)) + min);
    };

    LERPingSplines.prototype.start = function() {
      if (this.running) {

      } else {
        this.running = true;
        this.btn_play_pause.innerHTML = "&#x23F8;";
        return this.schedule_first_frame();
      }
    };

    LERPingSplines.prototype.stop = function() {
      this.running = false;
      return this.btn_play_pause.innerHTML = "&#x23F5;";
    };

    LERPingSplines.prototype.update_algorithm = function() {
      if (this.curve == null) {
        return;
      }
      if (this.option.show_algorithm.value) {
        return this.algorithm_text.innerText = this.curve.get_algorithm_text();
      }
    };

    LERPingSplines.prototype.on_show_algorithm_true = function() {
      this.algorithmbox.classList.remove('hidden');
      return this.update_algorithm();
    };

    LERPingSplines.prototype.on_hide_algorithm_false = function() {
      return this.algorithmbox.classList.add('hidden');
    };

    LERPingSplines.prototype.clamp_to_canvas = function(v) {
      if (v.x < this.point_move_margin.min_x) {
        v.x = this.point_move_margin.min_x;
      }
      if (v.y < this.point_move_margin.min_y) {
        v.y = this.point_move_margin.min_y;
      }
      if (v.x > this.point_move_margin.max_x) {
        v.x = this.point_move_margin.max_x;
      }
      if (v.y > this.point_move_margin.max_y) {
        v.y = this.point_move_margin.max_y;
      }
      return v;
    };

    LERPingSplines.prototype.get_mouse_coord = function(event) {
      var cc, coord;
      cc = this.graph_canvas.getBoundingClientRect();
      coord = {
        x: event.pageX - cc.left,
        y: event.pageY - cc.top
      };
      coord.x -= window.scrollX;
      coord.y -= window.scrollY;
      return this.clamp_to_canvas(coord);
    };

    LERPingSplines.prototype.on_mousemove_tslider = function(event) {
      var mouse, offset;
      mouse = this.get_mouse_coord(event);
      offset = mouse.x - this.tslider.drag_start;
      this.set_tslider_position(this.tslider.drag_start_position + offset);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_mousemove_canvas = function(event) {
      var dx, dy, mouse, oldhover, oldx, oldy, p, ref, results;
      mouse = this.get_mouse_coord(event);
      ref = this.curve.each_point();
      results = [];
      for (p of ref) {
        oldx = p.x;
        oldy = p.y;
        dx = mouse.x - oldx;
        dy = mouse.y - oldy;
        if (p.selected) {
          if ((p.x !== mouse.x) || (p.y !== mouse.y)) {
            this.point_has_changed = true;
          }
          p.x = mouse.x;
          p.y = mouse.y;
          if ((this.spline_mode || this.matrix_spline_mode) && (this.curve.order === 3) && APP.option.connect_cubic_control_points.get()) {
            if (p.knot) {
              if (p.prev != null) {
                p.prev.x += dx;
                p.prev.y += dy;
              }
              if (p.next != null) {
                p.next.x += dx;
                p.next.y += dy;
              }
            } else {
              if (!this.shift) {
                if ((p.prev != null) && (p.prev.prev != null) && p.prev.knot) {
                  p.prev.prev.mirror_around_next_knot();
                } else if ((p.next != null) && (p.next.next != null) && p.next.knot) {
                  p.next.next.mirror_around_prev_knot();
                }
              }
            }
          }
        }
        oldhover = p.hover;
        if (p.contains(mouse.x, mouse.y)) {
          p.hover = true;
        } else {
          p.hover = false;
        }
        if ((p.hover !== oldhover) || (p.x !== oldx) || (p.y !== oldy)) {
          results.push(this.update_and_draw());
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    LERPingSplines.prototype.on_mousemove = function(event) {
      if (this.tslider.drag_active) {
        return this.on_mousemove_tslider(event);
      } else {
        return this.on_mousemove_canvas(event);
      }
    };

    LERPingSplines.prototype.on_tslider_mousedown = function(event) {
      var mouse;
      this.tslider.drag_active = true;
      mouse = this.get_mouse_coord(event);
      this.tslider.drag_start = mouse.x;
      this.tslider.drag_start_position = this.tslider.position;
      this.tslider.handle.classList.add('drag');
      if (this.running) {
        return this.stop();
      }
    };

    LERPingSplines.prototype.on_mousedown = function(event) {
      var mouse, p;
      this.point_has_changed = false;
      mouse = this.get_mouse_coord(event);
      p = this.curve.find_point(mouse.x, mouse.y);
      if (p != null) {
        return p.selected = true;
      }
    };

    LERPingSplines.prototype.on_mouseup_tslider = function(event) {
      this.tslider.drag_active = false;
      return this.tslider.handle.classList.remove('drag');
    };

    LERPingSplines.prototype.on_mouseup_canvas = function(event) {
      var p, ref;
      ref = this.curve.each_point();
      for (p of ref) {
        p.selected = false;
      }
      if (this.point_has_changed) {
        return this.update_algorithm();
      }
    };

    LERPingSplines.prototype.on_mouseup = function(event) {
      if (this.tslider.drag_active) {
        return this.on_mouseup_tslider(event);
      } else {
        return this.on_mouseup_canvas(event);
      }
    };

    LERPingSplines.prototype.on_keydown = function(event) {
      switch (event.key) {
        case "Shift":
          return this.shift = true;
      }
    };

    LERPingSplines.prototype.on_keyup = function(event) {
      switch (event.key) {
        case "Shift":
          return this.shift = false;
      }
    };

    LERPingSplines.prototype.draw = function() {
      return this.curve.draw();
    };

    LERPingSplines.prototype.redraw_ui = function(render_bitmap_preview) {
      var l, len, len1, o, order, p, ref;
      if (render_bitmap_preview == null) {
        render_bitmap_preview = true;
      }
      this.graph_ui_ctx.clearRect(0, 0, this.graph_ui_canvas.width, this.graph_ui_canvas.height);
      ref = this.canvas.points;
      for (l = 0, len = ref.length; l < len; l++) {
        order = ref[l];
        for (o = 0, len1 = order.length; o < len1; o++) {
          p = order[o];
          p.draw_ui();
        }
      }
      return null;
    };

    LERPingSplines.prototype.update_at = function(t) {
      return this.curve.update_at(t);
    };

    LERPingSplines.prototype.update = function() {
      return this.update_at(this.t);
    };

    LERPingSplines.prototype.update_and_draw = function() {
      this.graph_ctx.clearRect(0, 0, this.graph_canvas.width, this.graph_canvas.height);
      if (this.option.show_ticks.value) {
        this.curve.draw_ticks();
      }
      this.curve.draw_curve();
      this.update();
      this.curve.draw();
      if (this.option.show_pen_label.value) {
        return this.curve.draw_pen();
      }
    };

    LERPingSplines.prototype.update_callback = function(timestamp) {
      var elapsed;
      this.frame_is_scheduled = false;
      elapsed = timestamp - this.prev_anim_timestamp;
      if (elapsed > 0) {
        this.prev_anim_timestamp = this.anim_timestamp;
        this.set_t_perc(this.t_perc + this.t_step);
        this.set_tslider_position(this.tslider.min + (this.t_perc * this.tslider.range));
        this.update_and_draw();
      }
      if (this.running) {
        this.schedule_next_frame();
      }
      return null;
    };

    LERPingSplines.prototype.schedule_next_frame = function() {
      if (this.running) {
        if (!this.frame_is_scheduled) {
          this.frame_is_scheduled = true;
          window.requestAnimationFrame(this.update_callback);
        }
      }
      return null;
    };

    LERPingSplines.prototype.first_update_callback = function(timestamp) {
      this.anim_timestamp = timestamp;
      this.prev_anim_timestamp = timestamp;
      this.frame_is_scheduled = false;
      return this.schedule_next_frame();
    };

    LERPingSplines.prototype.schedule_first_frame = function() {
      if (this.running) {
        this.frame_is_scheduled = true;
        window.requestAnimationFrame(this.first_update_callback);
      }
      return null;
    };

    return LERPingSplines;

  })();

  document.addEventListener('DOMContentLoaded', (function(_this) {
    return function() {
      window.APP = new LERPingSplines(document);
      window.APP.init();
      return window.APP.draw();
    };
  })(this));

  clone = function(obj) {
    var flags, key, newInstance;
    if ((obj == null) || typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    if (obj instanceof RegExp) {
      flags = '';
      if (obj.global != null) {
        flags += 'g';
      }
      if (obj.ignoreCase != null) {
        flags += 'i';
      }
      if (obj.multiline != null) {
        flags += 'm';
      }
      if (obj.sticky != null) {
        flags += 'y';
      }
      return new RegExp(obj.source, flags);
    }
    newInstance = new obj.constructor();
    for (key in obj) {
      newInstance[key] = clone(obj[key]);
    }
    return newInstance;
  };

  Vec2 = (function() {
    function Vec2() {}

    Vec2.lerp = function(a, b, amount) {
      return {
        x: a.x + (amount * (b.x - a.x)),
        y: a.y + (amount * (b.y - a.y))
      };
    };

    Vec2.magnitude = function(v) {
      return Math.sqrt((v.x * v.x) + (v.y * v.y));
    };

    Vec2.add = function(a, b) {
      return {
        x: a.x + b.x,
        y: a.y + b.y
      };
    };

    Vec2.sub = function(a, b) {
      return {
        x: a.x - b.x,
        y: a.y - b.y
      };
    };

    Vec2.scale = function(v, scale) {
      return {
        x: v.x * scale,
        y: v.y * scale
      };
    };

    Vec2.rotate = function(v, angle) {
      var c, s;
      c = Math.cos(angle);
      s = Math.sin(angle);
      return {
        x: (v.x * c) - (v.y * s),
        y: (v.x * s) + (v.y * c)
      };
    };

    Vec2.normalize = function(v) {
      var ilength, length, result;
      result = {
        x: 0.0,
        y: 0.0
      };
      length = Math.sqrt((v.x * v.x) + (v.y * v.y));
      if (length > 0) {
        ilength = 1.0 / length;
        result.x = v.x * ilength;
        result.y = v.y * ilength;
      }
      return result;
    };

    return Vec2;

  })();

  
/* copied from: https://raw.githubusercontent.com/Pomax/bezierinfo/refs/heads/master/js/graphics-element/api/types/matrix.js */

function invert(M) {
  // Copied from http://blog.acipo.com/matrix-inversion-in-javascript/
  // With permission, http://blog.acipo.com/matrix-inversion-in-javascript/#comment-5057289889

  // (1) 'augment' the matrix (left) by the identity (on the right)
  // (2) Turn the matrix on the left into the identity by elemetry row ops
  // (3) The matrix on the right is the inverse (was the identity matrix)
  // There are 3 elemtary row ops:
  // (a) Swap 2 rows
  // (b) Multiply a row by a scalar
  // (c) Add 2 rows

  //if the matrix isn't square: exit (error)
  if (M.length !== M[0].length) {
    console.log("not square");
    return;
  }

  //create the identity matrix (I), and a copy (C) of the original
  var i = 0,
    ii = 0,
    j = 0,
    dim = M.length,
    e = 0,
    t = 0;
  var I = [],
    C = [];
  for (i = 0; i < dim; i += 1) {
    // Create the row
    I[I.length] = [];
    C[C.length] = [];
    for (j = 0; j < dim; j += 1) {
      //if we're on the diagonal, put a 1 (for identity)
      if (i == j) {
        I[i][j] = 1;
      } else {
        I[i][j] = 0;
      }

      // Also, make the copy of the original
      C[i][j] = M[i][j];
    }
  }

  // Perform elementary row operations
  for (i = 0; i < dim; i += 1) {
    // get the element e on the diagonal
    e = C[i][i];

    // if we have a 0 on the diagonal (we'll need to swap with a lower row)
    if (e == 0) {
      //look through every row below the i'th row
      for (ii = i + 1; ii < dim; ii += 1) {
        //if the ii'th row has a non-0 in the i'th col
        if (C[ii][i] != 0) {
          //it would make the diagonal have a non-0 so swap it
          for (j = 0; j < dim; j++) {
            e = C[i][j]; //temp store i'th row
            C[i][j] = C[ii][j]; //replace i'th row by ii'th
            C[ii][j] = e; //repace ii'th by temp
            e = I[i][j]; //temp store i'th row
            I[i][j] = I[ii][j]; //replace i'th row by ii'th
            I[ii][j] = e; //repace ii'th by temp
          }
          //don't bother checking other rows since we've swapped
          break;
        }
      }
      //get the new diagonal
      e = C[i][i];
      //if it's still 0, not invertable (error)
      if (e == 0) {
        return;
      }
    }

    // Scale this row down by e (so we have a 1 on the diagonal)
    for (j = 0; j < dim; j++) {
      C[i][j] = C[i][j] / e; //apply to original matrix
      I[i][j] = I[i][j] / e; //apply to identity
    }

    // Subtract this row (scaled appropriately for each row) from ALL of
    // the other rows so that there will be 0's in this column in the
    // rows above and below this one
    for (ii = 0; ii < dim; ii++) {
      // Only apply to other rows (we want a 1 on the diagonal)
      if (ii == i) {
        continue;
      }

      // We want to change this element to 0
      e = C[ii][i];

      // Subtract (the row above(or below) scaled by e) from (the
      // current row) but start at the i'th column and assume all the
      // stuff left of diagonal is 0 (which it should be if we made this
      // algorithm correctly)
      for (j = 0; j < dim; j++) {
        C[ii][j] -= e * C[i][j]; //apply to original matrix
        I[ii][j] -= e * I[i][j]; //apply to identity
      }
    }
  }

  //we've done all operations, C should be the identity
  //matrix I should be the inverse:
  return I;
}

function multiply(m1, m2) {
  var M = [];
  var m2t = transpose(m2);
  m1.forEach((row, r) => {
    M[r] = [];
    m2t.forEach((col, c) => {
      M[r][c] = row.map((v, i) => col[i] * v).reduce((a, v) => a + v, 0);
    });
  });
  return M;
}

function transpose(M) {
  return M[0].map((col, i) => M.map((row) => row[i]));
}

class Matrix {
  constructor(n, m, data) {
    data = n instanceof Array ? n : data;
    this.data = data ?? [...new Array(n)].map((v) => [...new Array(m)].map((v) => 0));
    this.rows = this.data.length;
    this.cols = this.data[0].length;
  }
  setData(data) {
    this.data = data;
  }
  get(i, j) {
    return this.data[i][j];
  }
  set(i, j, value) {
    this.data[i][j] = value;
  }
  row(i) {
    return this.data[i];
  }
  col(j) {
    var d = this.data,
      col = [];
    for (let r = 0, l = d.length; r < l; r++) {
      col.push(d[r][j]);
    }
    return col;
  }
  multiply(other) {
    return new Matrix(multiply(this.data, other.data));
  }
  invert() {
    return new Matrix(invert(this.data));
  }
  transpose() {
    return new Matrix(transpose(this.data));
  }
}

/*export { Matrix };*/
;

  Point = (function() {
    function Point(color1) {
      this.color = color1;
      this.reset();
      this.order = 0;
      this.radius = LERPingSplines.point_radius;
      if (this.color == null) {
        this.color = '#000';
      }
      if (this.label_color == null) {
        this.label_color = '#000';
      }
      this.show_label = true;
      this.set_random_position();
      this.position = {
        x: this.x,
        y: this.y
      };
      this.label_position = {
        x: this.x,
        y: this.y
      };
    }

    Point.prototype.reset = function() {
      this.enabled = false;
      this.hover = false;
      return this.selected = false;
    };

    Point.prototype.set_label = function(label1) {
      this.label = label1;
      this.label_metrics = APP.graph_ctx.measureText(this.label);
      this.label_width = this.label_metrics.width;
      return this.label_height = LERPingSplines.point_label_height;
    };

    Point.prototype.get_label = function() {
      return this.label;
    };

    Point.prototype.set_random_position = function() {
      return this.set_fract_position(Math.random(), Math.random());
    };

    Point.prototype.set_fract_position = function(x, y) {
      var margin, range;
      margin = LERPingSplines.create_point_margin;
      range = 1.0 - (2.0 * margin);
      x = margin + (range * x);
      y = margin + (range * y);
      return this.move(x * APP.graph_width, y * APP.graph_height);
    };

    Point.prototype.move = function(x, y) {
      this.x = x;
      return this.y = y;
    };

    Point.prototype.contains = function(x, y) {
      var dist, dx, dy;
      dx = this.x - x;
      dy = this.y - y;
      dist = Math.sqrt((dx * dx) + (dy * dy));
      return dist <= this.radius + LERPingSplines.mouseover_point_radius_boost;
    };

    Point.prototype.mirror_around_prev_knot = function() {
      var delta, newpos;
      delta = Vec2.sub(this.prev, this.prev.prev);
      newpos = Vec2.add(this.prev, delta);
      this.x = newpos.x;
      return this.y = newpos.y;
    };

    Point.prototype.mirror_around_next_knot = function() {
      var delta, newpos;
      delta = Vec2.sub(this.next, this.next.next);
      newpos = Vec2.add(this.next, delta);
      this.x = newpos.x;
      return this.y = newpos.y;
    };

    Point.prototype.mirror_around_knot = function() {
      if ((this.prev != null) && (this.prev.prev != null) && this.prev.knot) {
        return this.mirror_around_prev_knot();
      } else if ((this.next != null) && (this.next.next != null) && this.next.knot) {
        return this.mirror_around_next_knot();
      }
    };

    Point.prototype.update = function(t) {
      this.position.x = this.x;
      this.position.y = this.y;
      this.x_is_left = true;
      if ((this.position.x > (APP.graph_width / 2.0)) && (this.position.x < APP.point_label_flip_margin.max_x)) {
        this.x_is_left = false;
      }
      if (this.position.x <= APP.point_label_flip_margin.min_x) {
        this.x_is_left = false;
      }
      if (this.x_is_left) {
        this.label_position.x = this.position.x - this.label_width - 13;
      } else {
        this.label_position.x = this.position.x + this.label_width - 1;
      }
      this.y_is_top = true;
      if ((this.position.y > (APP.graph_height / 2.0)) && (this.position.y < APP.point_label_flip_margin.max_y)) {
        this.y_is_top = false;
      }
      if (this.position.y <= APP.point_label_flip_margin.min_y) {
        this.y_is_top = false;
      }
      if (this.y_is_top) {
        return this.label_position.y = this.position.y - this.label_height + 2;
      } else {
        return this.label_position.y = this.position.y + this.label_height + 8;
      }
    };

    Point.prototype.draw = function() {
      var ctx, inner_radius, radius;
      if (!this.enabled) {
        return;
      }
      ctx = APP.graph_ctx;
      radius = this.radius = 5;
      inner_radius = radius * 0.8;
      if (this.hover) {
        ctx.beginPath();
        ctx.fillStyle = '#ff0';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.arc(this.x, this.y, radius * 3, 0, TAU);
        ctx.fill();
        ctx.stroke();
        radius *= 1.5;
        inner_radius = this.radius * 0.7;
      }
      ctx.beginPath();
      if (APP.spline_mode && !this.knot) {
        ctx.arc(this.x, this.y, inner_radius, 0, TAU, true);
      }
      ctx.arc(this.x, this.y, radius, 0, TAU);
      ctx.fillStyle = this.color;
      ctx.fill();
      if (this.label && this.show_label) {
        ctx.fillStyle = this.label_color;
        return ctx.fillText(this.label, this.label_position.x, this.label_position.y);
      }
    };

    return Point;

  })();

  LERP = (function(superClass) {
    extend(LERP, superClass);

    function LERP(order1, from, to) {
      this.order = order1;
      this.from = from;
      this.to = to;
      this.enabled = false;
      this.radius = 5;
      this.color = (function() {
        switch (this.order) {
          case 1:
            return '#451C92';
          case 2:
            return '#2D42DC';
          case 3:
            return '#A243DC';
          case 4:
            return '#D44143';
          case 5:
            return '#D98F46';
          case 6:
            return '#70D942';
          case 7:
            return '#6E55FF';
          default:
            return '#555';
        }
      }).call(this);
      this.position = {
        x: this.from.x,
        y: this.from.y
      };
      this.prev_position = {
        x: null,
        y: null
      };
    }

    LERP.prototype.generate_label = function(order, index) {
      this.label = "" + this.from.label + this.to.label;
      return this.alg_label = "temp_" + order + "_" + index;
    };

    LERP.prototype.get_label = function() {
      if (APP.option.alt_algorithm_names.value) {
        return this.label;
      } else {
        return this.alg_label;
      }
    };

    LERP.prototype.interpolate = function(t, a, b) {
      return (t * b) + ((1 - t) * a);
    };

    LERP.prototype.update = function(t) {
      this.enabled = this.from.enabled && this.to.enabled;
      this.position.x = this.interpolate(t, this.from.position.x, this.to.position.x);
      return this.position.y = this.interpolate(t, this.from.position.y, this.to.position.y);
    };

    LERP.prototype.draw = function() {
      var ctx, draw_from_to_line;
      if (!this.enabled) {
        return;
      }
      ctx = APP.graph_ctx;
      draw_from_to_line = true;
      if (draw_from_to_line) {
        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.moveTo(this.from.position.x, this.from.position.y);
        ctx.lineTo(this.to.position.x, this.to.position.y);
        ctx.stroke();
      }
      ctx.beginPath();
      if (APP.curve.pen === this) {
        ctx.arc(this.position.x, this.position.y, this.radius + 3, 0, TAU);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.globalOpacity = 0.4;
        ctx.stroke();
        return ctx.globalOpacity = 1.0;
      } else {
        ctx.lineWidth = 3;
        ctx.arc(this.position.x, this.position.y, this.radius + 1, 0, TAU);
        return ctx.stroke();
      }
    };

    LERP.prototype.update_order_0_point_label_color = function() {
      var color, hsv, p, ref, results, rgb;
      if (APP.curve == null) {
        return;
      }
      rgb = Color.hex2rgb(this.color);
      hsv = Color.rgb2hsv(rgb[0], rgb[1], rgb[2]);
      hsv[0] += 0.7;
      if (hsv[0] > 1.0) {
        hsv[0] -= 1.0;
      }
      hsv[1] *= 0.5;
      hsv[2] *= 0.55;
      rgb = Color.hsv2rgb(hsv[0], hsv[1], hsv[2]);
      color = Color.rgbarr2hex(rgb);
      ref = APP.curve.each_point();
      results = [];
      for (p of ref) {
        results.push(p.label_color = color);
      }
      return results;
    };

    return LERP;

  })(Point);

  window.UI || (window.UI = {});

  UI.Option = (function() {
    Option.create_input_element = function(type, id) {
      var el;
      if (type == null) {
        type = null;
      }
      if (id == null) {
        id = null;
      }
      el = window.APP.context.createElement('input');
      if (id != null) {
        el.id = id;
      }
      if (type != null) {
        el.type = type;
      }
      return el;
    };

    function Option(id1, default_value, callback) {
      var stored_value;
      this.id = id1;
      if (default_value == null) {
        default_value = null;
      }
      this.callback = callback != null ? callback : {};
      this.on_input = bind(this.on_input, this);
      this.on_change = bind(this.on_change, this);
      if (this.id instanceof Element) {
        this.id = this.el.id;
      } else {
        this.el = window.APP.context.getElementById(this.id);
        if (this.el == null) {
          console.log("ERROR - could not find element with id=\"" + this.id + "\"");
        }
      }
      this.persist = true;
      this.storage_id = "ui_option-" + this.id;
      this.label_id = this.id + "_label";
      this.label_el = window.APP.context.getElementById(this.label_id);
      this.label_text_formater = this.default_label_text_formater;
      if (default_value != null) {
        this["default"] = default_value;
      } else {
        this["default"] = this.detect_default_value();
      }
      stored_value = APP.storage_get(this.storage_id);
      if (stored_value != null) {
        this.set(stored_value);
      } else {
        this.set(this["default"]);
      }
      this.setup_listeners();
    }

    Option.prototype.setup_listeners = function() {
      this.el.addEventListener('change', this.on_change);
      return this.el.addEventListener('input', this.on_input);
    };

    Option.prototype.detect_default_value = function() {
      return this.get();
    };

    Option.prototype.reset = function() {
      APP.storage_remove(this.storage_id);
      return this.set(this["default"]);
    };

    Option.prototype.register_callback = function(opt) {
      var func, key, name, ref, results;
      if (opt == null) {
        opt = {};
      }
      for (name in opt) {
        func = opt[name];
        this.callback[name] = func;
      }
      ref = this.callback;
      results = [];
      for (key in ref) {
        func = ref[key];
        if (func == null) {
          results.push(delete this.callback[name]);
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Option.prototype.set_value = function(new_value) {
      if (new_value == null) {
        new_value = null;
      }
      if (new_value != null) {
        this.value = new_value;
      }
      if (this.label_el != null) {
        this.label_el.innerText = this.label_text();
      }
      if (this.persist) {
        return APP.storage_set(this.storage_id, this.value, this["default"]);
      }
    };

    Option.prototype.default_label_text_formater = function(value) {
      return "" + value;
    };

    Option.prototype.label_text = function() {
      return this.label_text_formater(this.value);
    };

    Option.prototype.set_label_text_formater = function(func) {
      this.label_text_formater = func;
      return this.set_value();
    };

    Option.prototype.on_change = function(event) {
      var base;
      this.set(this.get(event.target), false);
      return typeof (base = this.callback).on_change === "function" ? base.on_change(this.value) : void 0;
    };

    Option.prototype.on_input = function(event) {
      var base;
      this.set(this.get(event.target), false);
      return typeof (base = this.callback).on_input === "function" ? base.on_input(this.value) : void 0;
    };

    Option.prototype.enable = function() {
      return this.el.disabled = false;
    };

    Option.prototype.disable = function() {
      return this.el.disabled = true;
    };

    Option.prototype.destroy = function() {
      if (this.el != null) {
        this.el.remove();
      }
      return this.el = null;
    };

    return Option;

  })();

  UI.BoolOption = (function(superClass) {
    extend(BoolOption, superClass);

    BoolOption.create = function() {
      var id1, opt, parent, rest;
      parent = arguments[0], id1 = arguments[1], rest = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      this.id = id1;
      opt = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(UI.BoolOption, [UIOption.create_input_element('checkbox', this.id)].concat(slice.call(rest)), function(){});
      parent.appendChild(opt.el);
      return opt;
    };

    function BoolOption() {
      var args, parent;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      this.on_bool_option_state_off_click = bind(this.on_bool_option_state_off_click, this);
      this.on_bool_option_state_on_click = bind(this.on_bool_option_state_on_click, this);
      BoolOption.__super__.constructor.apply(this, args);
      parent = this.el.parentElement;
      this.on_el = window.APP.context.createElement('span');
      this.on_el.id = this.id + "_on";
      this.on_el.textContent = "On";
      this.on_el.classList.add("bool_option_state");
      this.on_el.classList.add("on");
      this.on_el.addEventListener('click', this.on_bool_option_state_on_click);
      parent.appendChild(this.on_el);
      this.off_el = window.APP.context.createElement('span');
      this.off_el.id = this.id + "_off";
      this.off_el.textContent = "Off";
      this.off_el.classList.add("bool_option_state");
      this.off_el.classList.add("off");
      this.off_el.addEventListener('click', this.on_bool_option_state_off_click);
      parent.appendChild(this.off_el);
      this.el.classList.add("hidden");
      this.set(this.get());
    }

    BoolOption.prototype.on_bool_option_state_on_click = function() {
      var base;
      this.set(false);
      return typeof (base = this.callback).on_change === "function" ? base.on_change(this.value) : void 0;
    };

    BoolOption.prototype.on_bool_option_state_off_click = function() {
      var base;
      this.set(true);
      return typeof (base = this.callback).on_change === "function" ? base.on_change(this.value) : void 0;
    };

    BoolOption.prototype.get = function(element) {
      if (element == null) {
        element = this.el;
      }
      return element.checked;
    };

    BoolOption.prototype.set = function(bool_value, update_element) {
      var base, base1, newvalue, oldvalue;
      if (update_element == null) {
        update_element = true;
      }
      oldvalue = this.value;
      newvalue = (function() {
        switch (bool_value) {
          case 'true':
            return true;
          case 'false':
            return false;
          default:
            return !!bool_value;
        }
      })();
      if (update_element) {
        this.el.checked = newvalue;
      }
      this.set_value(newvalue);
      if (oldvalue !== newvalue) {
        if (newvalue) {
          return typeof (base = this.callback).on_true === "function" ? base.on_true() : void 0;
        } else {
          return typeof (base1 = this.callback).on_false === "function" ? base1.on_false() : void 0;
        }
      }
    };

    BoolOption.prototype.set_value = function(new_value) {
      if (new_value == null) {
        new_value = null;
      }
      BoolOption.__super__.set_value.call(this, new_value);
      return this.update_on_off_classes();
    };

    BoolOption.prototype.update_on_off_classes = function() {
      if (this.get()) {
        if (this.on_el != null) {
          this.on_el.classList.remove('hidden');
        }
        if (this.off_el != null) {
          return this.off_el.classList.add('hidden');
        }
      } else {
        if (this.on_el != null) {
          this.on_el.classList.add('hidden');
        }
        if (this.off_el != null) {
          return this.off_el.classList.remove('hidden');
        }
      }
    };

    return BoolOption;

  })(UI.Option);

  UI.IntOption = (function(superClass) {
    extend(IntOption, superClass);

    function IntOption() {
      return IntOption.__super__.constructor.apply(this, arguments);
    }

    IntOption.create = function() {
      var id1, opt, parent, rest;
      parent = arguments[0], id1 = arguments[1], rest = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      this.id = id1;
      opt = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(UI.IntOption, [UIOption.create_input_element('number', this.id)].concat(slice.call(rest)), function(){});
      parent.appendChild(opt.el);
      return opt;
    };

    IntOption.prototype.get = function(element) {
      if (element == null) {
        element = this.el;
      }
      return parseInt(element.value);
    };

    IntOption.prototype.set = function(number_value, update_element) {
      if (update_element == null) {
        update_element = true;
      }
      this.set_value(parseInt(number_value));
      if (update_element) {
        return this.el.value = this.value;
      }
    };

    return IntOption;

  })(UI.Option);

  UI.FloatOption = (function(superClass) {
    extend(FloatOption, superClass);

    function FloatOption() {
      return FloatOption.__super__.constructor.apply(this, arguments);
    }

    FloatOption.create = function() {
      var id1, opt, parent, rest;
      parent = arguments[0], id1 = arguments[1], rest = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      this.id = id1;
      opt = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(UI.IntOption, [UIOption.create_input_element(null, this.id)].concat(slice.call(rest)), function(){});
      parent.appendChild(opt.el);
      return opt;
    };

    FloatOption.prototype.get = function(element) {
      if (element == null) {
        element = this.el;
      }
      return parseFloat(element.value);
    };

    FloatOption.prototype.set = function(number_value, update_element) {
      if (update_element == null) {
        update_element = true;
      }
      this.set_value(parseFloat(number_value));
      if (update_element) {
        return this.el.value = this.value;
      }
    };

    return FloatOption;

  })(UI.Option);

  UI.PercentOption = (function(superClass) {
    extend(PercentOption, superClass);

    function PercentOption() {
      return PercentOption.__super__.constructor.apply(this, arguments);
    }

    PercentOption.prototype.label_text = function() {
      var perc;
      perc = parseInt(this.value * 100);
      return perc + "%";
    };

    return PercentOption;

  })(UI.FloatOption);

  UI.SelectOption = (function(superClass) {
    extend(SelectOption, superClass);

    function SelectOption() {
      return SelectOption.__super__.constructor.apply(this, arguments);
    }

    SelectOption.prototype.setup_listeners = function() {
      return this.el.addEventListener('change', this.on_change);
    };

    SelectOption.prototype.get = function(element) {
      var opt;
      if (element == null) {
        element = this.el;
      }
      opt = element.options[element.selectedIndex];
      if (opt != null) {
        return opt.value;
      } else {
        return null;
      }
    };

    SelectOption.prototype.set = function(option_name, update_element) {
      var opt;
      if (update_element == null) {
        update_element = true;
      }
      opt = this.option_with_name(option_name);
      if (opt != null) {
        this.set_value(opt.value);
        if (update_element) {
          return opt.selected = true;
        }
      }
    };

    SelectOption.prototype.values = function() {
      return this.el.options.map(function(x) {
        return x.name;
      });
    };

    SelectOption.prototype.option_with_name = function(name) {
      var l, len, opt, ref;
      ref = this.el.options;
      for (l = 0, len = ref.length; l < len; l++) {
        opt = ref[l];
        if (opt.value === name) {
          return opt;
        }
      }
      return null;
    };

    SelectOption.prototype.add_option = function(value, text, selected) {
      var opt;
      if (selected == null) {
        selected = false;
      }
      opt = document.createElement('option');
      opt.value = value;
      opt.text = text;
      this.el.add(opt, null);
      if (selected) {
        opt.selected = true;
      }
      return this.set(this.get());
    };

    return SelectOption;

  })(UI.Option);

  UI.ChoiceOption = (function(superClass) {
    extend(ChoiceOption, superClass);

    function ChoiceOption(group_class, default_value, callback) {
      var ref, stored_value;
      this.group_class = group_class;
      if (default_value == null) {
        default_value = null;
      }
      this.callback = callback != null ? callback : {};
      this.on_choice_click = bind(this.on_choice_click, this);
      this.setup_choice = bind(this.setup_choice, this);
      this.group_selector = "." + this.group_class;
      this.el_list = window.APP.context.querySelectorAll(this.group_selector);
      if (!(((ref = this.el_list) != null ? ref.length : void 0) > 0)) {
        console.log("ERROR - could not find with class \"" + this.name + "\"");
      }
      this.persist = true;
      this.storage_id = "ui_option-" + this.group_class;
      this.el_list.forEach(this.setup_choice);
      if (default_value != null) {
        this["default"] = default_value;
      } else {
        this["default"] = this.detect_default_value();
      }
      stored_value = APP.storage_get(this.storage_id);
      if (stored_value != null) {
        this.set(stored_value);
      } else {
        this.set(this["default"]);
      }
    }

    ChoiceOption.prototype.detect_default_value = function() {
      return this.el_list[0].dataset.value;
    };

    ChoiceOption.prototype.setup_choice = function(el) {
      return el.addEventListener('click', this.on_choice_click);
    };

    ChoiceOption.prototype.on_choice_click = function(event) {
      return this.set(event.target.dataset.value);
    };

    ChoiceOption.prototype.setup_listeners = function() {};

    ChoiceOption.prototype.set_value = function(new_value) {
      var base, old_value;
      if (new_value == null) {
        new_value = null;
      }
      if (new_value != null) {
        old_value = this.value;
        this.value = new_value;
        if (old_value !== new_value) {
          if (typeof (base = this.callback).on_change === "function") {
            base.on_change(this.value);
          }
        }
      } else {
        console.log("set_value(null) called for UI.ChoiceOption \"" + this.group_class + "\'");
      }
      if (this.persist) {
        return APP.storage_set(this.storage_id, this.value, this["default"]);
      }
    };

    ChoiceOption.prototype.get_element_with_value = function(value) {
      var el, l, len, ref;
      ref = this.el_list;
      for (l = 0, len = ref.length; l < len; l++) {
        el = ref[l];
        if (el.dataset.value === value) {
          return el;
        }
      }
      return null;
    };

    ChoiceOption.prototype.clear_selected = function() {
      var el, l, len, ref, results;
      ref = this.el_list;
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        el = ref[l];
        results.push(el.classList.remove('selected'));
      }
      return results;
    };

    ChoiceOption.prototype.get = function() {
      return this.value;
    };

    ChoiceOption.prototype.set = function(new_value, update_element) {
      var el;
      if (update_element == null) {
        update_element = true;
      }
      el = this.get_element_with_value(new_value);
      if (el != null) {
        this.set_value(new_value);
        if (update_element) {
          this.clear_selected();
          return el.classList.add('selected');
        }
      } else {
        return console.log("Invalid value \"" + new_value + "\" for UI.ChoiceOption \"" + this.group_class + "\'");
      }
    };

    ChoiceOption.prototype.change = function() {
      var base;
      return typeof (base = this.callback).on_change === "function" ? base.on_change(this.value) : void 0;
    };

    ChoiceOption.prototype.enable = function() {
      return this.el_list.forEach(function(el) {
        return el.classList.remove('disabled');
      });
    };

    ChoiceOption.prototype.disable = function() {
      return this.el_list.forEach(function(el) {
        return el.classList.add('disabled');
      });
    };

    return ChoiceOption;

  })(UI.Option);

  UI.ColorOption = (function(superClass) {
    extend(ColorOption, superClass);

    function ColorOption() {
      return ColorOption.__super__.constructor.apply(this, arguments);
    }

    ColorOption.prototype.get = function(element) {
      if (element == null) {
        element = this.el;
      }
      return element.value;
    };

    ColorOption.prototype.set = function(new_value, update_element) {
      if (update_element == null) {
        update_element = true;
      }
      this.set_value(new_value);
      if (update_element) {
        this.el.value = new_value;
      }
      return this.color;
    };

    return ColorOption;

  })(UI.Option);

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQUEsTUFBQSw4R0FBQTtJQUFBOzs7OztFQUFNOzs7SUFDSixLQUFDLENBQUEsT0FBRCxHQUFVLFNBQUMsQ0FBRDtBQUNSLFVBQUE7TUFBQSxHQUFBLEdBQVMsQ0FBQyxDQUFDLE1BQUYsS0FBWSxDQUFmLEdBQ0osQ0FBRSxDQUFFLENBQUEsQ0FBQSxDQUFGLEdBQU8sQ0FBRSxDQUFBLENBQUEsQ0FBWCxFQUNFLENBQUUsQ0FBQSxDQUFBLENBQUYsR0FBTyxDQUFFLENBQUEsQ0FBQSxDQURYLEVBRUUsQ0FBRSxDQUFBLENBQUEsQ0FBRixHQUFPLENBQUUsQ0FBQSxDQUFBLENBRlgsQ0FESSxHQUlFLENBQUMsQ0FBQyxNQUFGLEtBQVksQ0FBZixHQUNILENBQUUsQ0FBRSxDQUFBLENBQUEsQ0FBRixHQUFPLENBQUUsQ0FBQSxDQUFBLENBQVgsRUFDRSxDQUFFLENBQUEsQ0FBQSxDQUFGLEdBQU8sQ0FBRSxDQUFBLENBQUEsQ0FEWCxFQUVFLENBQUUsQ0FBQSxDQUFBLENBQUYsR0FBTyxDQUFFLENBQUEsQ0FBQSxDQUZYLENBREcsR0FLSCxLQUFBLENBQU0sVUFBQSxHQUFXLENBQVgsR0FBYSx3Q0FBbkI7QUFFRDtXQUFBLHFDQUFBOztxQkFBQSxRQUFBLENBQVMsS0FBVCxFQUFlLEVBQWYsQ0FBQSxHQUFxQjtBQUFyQjs7SUFaTzs7SUFjVixLQUFDLENBQUEsT0FBRCxHQUFVLFNBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQO2FBQ1IsS0FBSyxDQUFDLFVBQU4sQ0FBaUIsQ0FBQyxDQUFELEVBQUcsQ0FBSCxFQUFLLENBQUwsQ0FBakI7SUFEUTs7SUFHVixLQUFDLENBQUEsVUFBRCxHQUFhLFNBQUMsR0FBRDtBQUNYLFVBQUE7YUFBQSxHQUFBLEdBQU07O0FBQUM7YUFBQSxxQ0FBQTs7dUJBQUEsUUFBQSxDQUFTLEdBQUEsR0FBTSxLQUFmLEVBQXNC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QTtNQUNWLElBQUMsQ0FBQSxHQUFELEdBQU8sSUFBQyxDQUFBLFFBQUQsQ0FBQTtNQUVQLElBQUMsQ0FBQSxZQUFELENBQWMsR0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsT0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsTUFBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsT0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsS0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsT0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsTUFBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsT0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsSUFBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsT0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsTUFBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsT0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsS0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsT0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsTUFBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsT0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsR0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsT0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsTUFBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FBQSxZQUFELENBQWMsT0FBZCxFQUF1QixDQUF2QjtNQUNBLElBQUMsQ0FB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QUNOLFVBQUE7MEVBQVMsQ0FBQyxVQUFXLElBQUMsQ0FBQTtJQURoQjs7MkJBR1IsTUFBQSxHQUFRLFNBQUE7YUFDTixJQUFDLENBQUEsT0FBTyxDQUFDLE9BQVQsQ0FBa0IsU0FBQyxFQUFEO2VBQVEsRUFBRSxDQUFDLFNBQVMsQ0FBQyxNQUFiLENBQW9CLFVBQXBCO01BQVIsQ0FBbEI7SUFETTs7MkJBR1IsT0FBQSxHQUFTLFNBQUE7YUFDUCxJQUFDLENBQUEsT0FBTyxDQUFDLE9BQVQsQ0FBa0IsU0FBQyxFQUFEO2VBQVEsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFiLENBQWlCLFVBQWpCO01BQVIsQ0FBbEI7SUFETzs7OztLQTNFbUIsRUFBRSxDQUFDOztFQThFM0IsRUFBRSxDQUFDOzs7Ozs7OzBCQUNQLEdBQUEsR0FBSyxTQUFDLE9BQUQ7O1FBQUMsVUFBVSxJQUFDLENBQUE7O2FBQ2YsT0FBTyxDQUFDO0lBREw7OzBCQUdMLEdBQUEsR0FBSyxTQUFDLFNBQUQsRUFBWSxjQUFaOztRQUFZLGlCQUFpQjs7TUFDaEMsSUFBQyxDQUFBLFNBQUQsQ0FBVyxTQUFYO01BQ0EsSUFBeUIsY0FBekI7UUFBQSxJQUFDLENBQUEsRUFBRSxDQUFDLEtBQUosR0FBWSxVQUFaOzthQUNBLElBQUMsQ0FBQTtJQUhFOzs7O0tBSnNCLEVBQUUsQ0FBQztBQXpnRmhDIiwic291cmNlc0NvbnRlbnQiOlsiY2xhc3MgQ29sb3JcbiAgQGhleDJyZ2I6IChoKSAtPlxuICAgIGFyciA9IGlmIGgubGVuZ3RoID09IDRcbiAgICAgIFsgaFsxXSArIGhbMV0sXG4gICAgICAgIGhbMl0gKyBoWzJdLFxuICAgICAgICBoWzNdICsgaFszXSBdXG4gICAgZWxzZSBpZiBoLmxlbmd0aCA9PSA3XG4gICAgICBbIGhbMV0gKyBoWzJdLFxuICAgICAgICBoWzNdICsgaFs0XSxcbiAgICAgICAgaFs1XSArIGhbNl0gXVxuICAgIGVsc2VcbiAgICAgIHJhaXNlIFwic3RyaW5nICcje2h9JyBpcyBub3QgaW4gJyNSR0InIG9yICcjUlJHR0JCJyBmb3JtYXRcIlxuXG4gICAgKHBhcnNlSW50KHZhbHVlLDE2KSAvIDI1NSBmb3IgdmFsdWUgaW4gYXJyKVxuXG4gIEByZ2IyaGV4OiAociwgZywgYikgLT5cbiAgICBDb2xvci5yZ2JhcnIyaGV4KFtyLGcsYl0pXG5cbiAgQHJnYmFycjJoZXg6IChhcnIpIC0+XG4gICAgXCIjXCIgKyAocGFyc2VJbnQoMjU1ICogdmFsdWUsIDEwKS50b1N0cmluZygxNikucGFkU3RhcnQoMiwgJzAnKSBmb3IgdmFsdWUgaW4gYXJyKS5qb2luKCcnKVxuXG4gICNGUk9NOiBodHRwOi8vYXhvbmZsdXguY29tL2hhbmR5LXJnYi10by1oc2wtYW5kLXJnYi10by1oc3YtY29sb3ItbW9kZWwtY1xuICAjIFxuICAjICBDb252ZXJ0cyBhbiBSR0IgY29sb3IgdmFsdWUgdG8gSFNWLiBDb252ZXJzaW9uIGZvcm11bGFcbiAgIyAgYWRhcHRlZCBmcm9tIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSFNWX2NvbG9yX3NwYWNlLlxuICAjICBBc3N1bWVzIHIsIGcsIGFuZCBiIGFyZSBjb250YWluZWQgaW4gdGhlIHNldCBbMCwgMV0gYW5kXG4gICMgIHJldHVybnMgaCwgcywgYW5kIHYgaW4gdGhlIHNldCBbMCwgMV0uXG4gICMgICBcbiAgIyAgQHBhcmFtICAgTnVtYmVyICByICAgICAgIFRoZSByZWQgY29sb3IgdmFsdWVcbiAgIyAgQHBhcmFtICAgTnVtYmVyICBnICAgICAgIFRoZSBncmVlbiBjb2xvciB2YWx1ZVxuICAjICBAcGFyYW0gICBOdW1iZXIgIGIgICAgICAgVGhlIGJsdWUgY29sb3IgdmFsdWVcbiAgIyAgQHJldHVybiAgQXJyYXkgICAgICAgICAgIFRoZSBIU1YgcmVwcmVzZW50YXRpb25cbiAgQHJnYjJoc3Y6IChyLCBnLCBiKSAtPlxuICAgIG1heCA9IE1hdGgubWF4KHIsIGcsIGIpXG4gICAgbWluID0gTWF0aC5taW4ociwgZywgYilcblxuICAgIHYgPSBtYXhcbiAgICBkID0gbWF4IC0gbWluXG5cbiAgICBzID0gKGlmIG1heCBpcyAwIHRoZW4gMCBlbHNlIGQgLyBtYXgpXG5cbiAgICBpZiBtYXggaXMgbWluXG4gICAgICBoID0gMCAjIGFjaHJvbWF0aWNcbiAgICBlbHNlXG4gICAgICBoID0gc3dpdGNoIG1heFxuICAgICAgICB3aGVuIHIgdGhlbiAoZyAtIGIpIC8gZCArIChpZiBnIDwgYiB0aGVuIDYgZWxzZSAwKVxuICAgICAgICB3aGVuIGcgdGhlbiAoYiAtIHIpIC8gZCArIDJcbiAgICAgICAgd2hlbiBiIHRoZW4gKHIgLSBnKSAvIGQgKyA0XG4gICAgICBoIC89IDZcblxuICAgIFtoLCBzLCB2XVxuXG5cbiAgI0ZST006IGh0dHA6Ly9heG9uZmx1eC5jb20vaGFuZHktcmdiLXRvLWhzbC1hbmQtcmdiLXRvLWhzdi1jb2xvci1tb2RlbC1jXG4gICMgXG4gICMgIENvbnZlcnRzIGFuIEhTViBjb2xvciB2YWx1ZSB0byBSR0IuIENvbnZlcnNpb24gZm9ybXVsYVxuICAjICBhZGFwdGVkIGZyb20gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9IU1ZfY29sb3Jfc3BhY2UuXG4gICMgIEFzc3VtZXMgaCwgcywgYW5kIHYgYXJlIGNvbnRhaW5lZCBpbiB0aGUgc2V0IFswLCAxXSBhbmRcbiAgIyAgcmV0dXJucyByLCBnLCBhbmQgYiBpbiB0aGUgc2V0IFswLCAxXS5cbiAgIyAgXG4gICMgIEBwYXJhbSAgIE51bWJlciAgaCAgICAgICBUaGUgaHVlXG4gICMgIEBwYXJhbSAgIE51bWJlciAgcyAgICAgICBUaGUgc2F0dXJhdGlvblxuICAjICBAcGFyYW0gICBOdW1iZXIgIHYgICAgICAgVGhlIHZhbHVlXG4gICMgIEByZXR1cm4gIEFycmF5ICAgICAgICAgICBUaGUgUkdCIHJlcHJlc2VudGF0aW9uXG4gIEBoc3YycmdiOiAoaCwgcywgdikgLT5cbiAgICBpID0gTWF0aC5mbG9vcihoICogNilcbiAgICBmID0gaCAqIDYgLSBpXG4gICAgcCA9IHYgKiAoMSAtIHMpXG4gICAgcSA9IHYgKiAoMSAtIGYgKiBzKVxuICAgIHQgPSB2ICogKDEgLSAoMSAtIGYpICogcylcblxuICAgIHN3aXRjaCBpICUgNlxuICAgICAgd2hlbiAwIHRoZW4gW3YsIHQsIHBdXG4gICAgICB3aGVuIDEgdGhlbiBbcSwgdiwgcF1cbiAgICAgIHdoZW4gMiB0aGVuIFtwLCB2LCB0XVxuICAgICAgd2hlbiAzIHRoZW4gW3AsIHEsIHZdXG4gICAgICB3aGVuIDQgdGhlbiBbdCwgcCwgdl1cbiAgICAgIHdoZW4gNSB0aGVuIFt2LCBwLCBxXVxuXG5cbiMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjI1xuIyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjXG4jICBjdXJ2ZS5jb2ZmZWUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNcbiMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI1xuIyAgVGhpcyBmaWxlIGlzIHBhcnQgb2YgbGVycGluZ19zcGxpbmVzLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjXG4jICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNcbiMgIGxlcnBpbmdfc3BsaW5lcyBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgICAgICAgICAgI1xuIyAgbW9kaWZ5IGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkICAjXG4jICBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCAgICAgICAgICNcbiMgIG9yIChhdCB5b3VyIG9wdGlvbikgYW55IGxhdGVyIHZlcnNpb24uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI1xuIyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjXG4jICBsZXJwaW5nX3NwbGluZXMgaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgICAgICAgICNcbiMgIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mICAgICAgICAgICAgI1xuIyAgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLiBTZWUgdGhlIEdOVSBHZW5lcmFsICAjXG4jICBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNcbiMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI1xuIyAgWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgICAjXG4jICB3aXRoIGxlcnBpbmdfc3BsaW5lcy4gSWYgbm90LCBzZWUgPGh0dHBzOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi4gICAgICAgICNcbiMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI1xuIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjXG5cbmNsYXNzIEN1cnZlXG4gIGNvbnN0cnVjdG9yOiAtPlxuICAgIEBwb2ludHMgPSBbXVxuICAgIEBlbmFibGVkX3BvaW50cyA9IDBcbiAgICBAdWlfZW5hYmxlZCA9IHRydWVcblxuICAgIEBwZW5fbGFiZWwgPSAnUCdcbiAgICBAcGVuX2xhYmVsX21ldHJpY3MgPSBBUFAuZ3JhcGhfY3R4Lm1lYXN1cmVUZXh0KEBwZW5fbGFiZWwpXG4gICAgQHBlbl9sYWJlbF93aWR0aCAgID0gQHBlbl9sYWJlbF9tZXRyaWNzLndpZHRoXG4gICAgQHBlbl9sYWJlbF9oZWlnaHQgID0gTEVSUGluZ1NwbGluZXMucGVuX2xhYmVsX2hlaWdodFxuICAgIEBwZW5fbGFiZWxfb2Zmc2V0ID1cbiAgICAgIHg6IEBwZW5fbGFiZWxfd2lkdGggIC8gMlxuICAgICAgeTogQHBlbl9sYWJlbF9oZWlnaHQgLyAyXG5cbiAgICBAcGVuX2xhYmVsX29mZnNldF9sZW5ndGggPSBWZWMyLm1hZ25pdHVkZShAcGVuX2xhYmVsX29mZnNldClcblxuICByZXNldDogLT5cbiAgICBAcmVzZXRfcG9pbnRzKClcblxuICBkaXNhYmxlX3VpOiAtPlxuICAgIEB1aV9lbmFibGVkID0gZmFsc2VcblxuICBtaW5fcG9pbnRzOiAtPlxuICAgIEBjb25zdHJ1Y3Rvci5taW5fcG9pbnRzXG5cbiAgbWF4X3BvaW50czogLT5cbiAgICBAY29uc3RydWN0b3IubWF4X3BvaW50c1xuXG4gIGVhY2hfcG9pbnQ6IChpbmNsdWRlX2ZpcnN0ID0gdHJ1ZSkgLT5cbiAgICBmaXJzdCA9IHRydWVcbiAgICBmb3Igb3JkZXIgaW4gQHBvaW50c1xuICAgICAgZm9yIHAgaW4gb3JkZXJcbiAgICAgICAgaWYgZmlyc3RcbiAgICAgICAgICBmaXJzdCA9IGZhbHNlXG4gICAgICAgICAgeWllbGQgcCBpZiBpbmNsdWRlX2ZpcnN0XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB5aWVsZCBwXG4gICAgcmV0dXJuXG5cbiAgYWRkX2xlcnBzOiAtPlxuICAgIGZvciBvcmRlciBpbiBbMS4uQG1heF9wb2ludHMoKV1cbiAgICAgIEBwb2ludHNbb3JkZXJdID0gW11cbiAgICAgIHByZXZfb3JkZXIgPSBvcmRlciAtIDFcbiAgICAgIHByZXYgPSBAcG9pbnRzW3ByZXZfb3JkZXJdXG4gICAgICBmb3IgaiBpbiBbMC4uKEBtYXhfcG9pbnRzKCkgLSBvcmRlcildXG4gICAgICAgICNjb25zb2xlLmxvZyhcIm9yZGVyPSN7b3JkZXJ9IGo9I3tqfVwiLCBwcmV2KVxuICAgICAgICBicmVhayB1bmxlc3MgcHJldltqXT8gYW5kIHByZXZbaisxXT9cbiAgICAgICAgbGVycCA9IG5ldyBMRVJQKCBvcmRlciwgcHJldltqXSwgcHJldltqKzFdIClcbiAgICAgICAgQHBvaW50c1tvcmRlcl1bal0gPSBsZXJwXG4gICAgICAgIEBwb2ludHNbb3JkZXJdW2pdLmdlbmVyYXRlX2xhYmVsKG9yZGVyLCBqKVxuXG4gIHNldF9wb2ludHM6IChwb2ludHMpIC0+XG4gICAgZm9yIHAgaW4gcG9pbnRzXG4gICAgICBwLmVuYWJsZWQgPSB0cnVlXG4gICAgICBAZW5hYmxlZF9wb2ludHMgKz0gMVxuXG4gICAgQHBvaW50c1swXSA9IHBvaW50c1xuXG4gICAgQGZpcnN0X3BvaW50ID0gQHBvaW50c1swXVswXVxuICAgIEBsYXN0X3BvaW50ID0gQHBvaW50c1swXVsgQHBvaW50c1swXS5sZW5ndGggLSAxIF1cblxuICAgIEBhZGRfbGVycHMoKVxuICAgIEBzZXR1cF9sYWJlbCgpXG4gICAgQHNldHVwX3BlbigpXG5cbiAgcmVzZXRfcG9pbnRzOiAtPlxuICAgIGZvciBwIGZyb20gQGVhY2hfcG9pbnQoKVxuICAgICAgcC5yZXNldCgpXG5cbiAgZmluZF9wb2ludDogKHgsIHkpIC0+XG4gICAgZm9yIHAgZnJvbSBAZWFjaF9wb2ludCgpXG4gICAgICBpZiBwPy5jb250YWlucyh4LCB5KVxuICAgICAgICByZXR1cm4gcFxuICAgIHJldHVybiBudWxsXG5cbiAgc2V0dXBfcGVuOiAtPlxuICAgIEBwZW4gPSBAZmluZF9wZW4oKVxuXG4gIHNldHVwX2xhYmVsOiAtPlxuICAgIEBsYWJlbCA9IFwiI3tAZmlyc3RfcG9pbnQubGFiZWx9fiN7QGxhc3RfcG9pbnQubGFiZWx9XCJcblxuICB1cGRhdGVfZW5hYmxlZF9wb2ludHM6IC0+XG4gICAgaWYgQHVpX2VuYWJsZWRcbiAgICAgIGlmIEBlbmFibGVkX3BvaW50cyA8IEBtYXhfcG9pbnRzKClcbiAgICAgICAgQVBQLmFkZF9wb2ludF9idG4uZGlzYWJsZWQgPSBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBBUFAuYWRkX3BvaW50X2J0bi5kaXNhYmxlZCA9IHRydWVcblxuICAgICAgaWYgQGVuYWJsZWRfcG9pbnRzID4gQG1pbl9wb2ludHMoKVxuICAgICAgICBBUFAucmVtb3ZlX3BvaW50X2J0bi5kaXNhYmxlZCA9IGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIEFQUC5yZW1vdmVfcG9pbnRfYnRuLmRpc2FibGVkID0gdHJ1ZVxuXG4gICAgICBBUFAubnVtX3BvaW50cy50ZXh0Q29udGVudCA9IFwiI3tAZW5hYmxlZF9wb2ludHN9XCJcblxuICAgIEB1cGRhdGUoKVxuXG4gICAgQGZpcnN0X3BvaW50ID0gQHBvaW50c1swXVswXVxuICAgIGkgPSBAcG9pbnRzWzBdLmxlbmd0aCAtIDFcbiAgICBpLS0gd2hpbGUgaSA+IDAgYW5kICFAcG9pbnRzWzBdW2ldLmVuYWJsZWRcbiAgICBAbGFzdF9wb2ludCA9IEBwb2ludHNbMF1baV1cblxuICAgIEBzZXR1cF9sYWJlbCgpXG4gICAgQHNldHVwX3BlbigpXG4gICAgQVBQLnVwZGF0ZV9hbGdvcml0aG0oKVxuXG4gIG9yZGVyX3VwX3JlYmFsYW5jZTogLT5cblxuICBlbmFibGVfcG9pbnQ6IChyZWJhbGFuY2VfcG9pbnRzKSAtPlxuICAgIHJldHVybiBpZiBAZW5hYmxlZF9wb2ludHMgPj0gQG1heF9wb2ludHMoKVxuICAgIHAgPSBAcG9pbnRzWzBdW0BlbmFibGVkX3BvaW50c11cblxuICAgIGlmIHJlYmFsYW5jZV9wb2ludHMgYW5kIEFQUC5vcHRpb24ucmViYWxhbmNlX3BvaW50c19vbl9vcmRlcl91cC52YWx1ZSBhbmQgQVBQLmJlemllcl9tb2RlXG4gICAgICBAb3JkZXJfdXBfcmViYWxhbmNlKClcblxuICAgIHAuZW5hYmxlZCA9IHRydWVcbiAgICBAZW5hYmxlZF9wb2ludHMgKz0gMVxuICAgIEB1cGRhdGVfZW5hYmxlZF9wb2ludHMoKVxuICAgIHBcblxuICBlbmFibGVfcG9pbnRfYXQ6ICh4LCB5KSAtPlxuICAgIHAgPSBAZW5hYmxlX3BvaW50KGZhbHNlKVxuICAgIHAueCA9IHggKiBBUFAuZ3JhcGhfd2lkdGhcbiAgICBwLnkgPSB5ICogQVBQLmdyYXBoX2hlaWdodFxuICAgIHBcblxuICBjb21wdXRlX2xvd2VyX29yZGVyX2N1cnZlOiAtPlxuXG4gIGRpc2FibGVfcG9pbnQ6IC0+XG4gICAgcmV0dXJuIGlmIEBlbmFibGVkX3BvaW50cyA8PSBAbWluX3BvaW50cygpXG5cbiAgICBpZiBAZW5hYmxlZF9wb2ludHMgPiAzIGFuZCBBUFAub3B0aW9uLnJlYmFsYW5jZV9wb2ludHNfb25fb3JkZXJfZG93bi52YWx1ZSBhbmQgQVBQLmJlemllcl9tb2RlXG4gICAgICBAY29tcHV0ZV9sb3dlcl9vcmRlcl9jdXJ2ZSgpXG5cbiAgICBAZW5hYmxlZF9wb2ludHMgLT0gMVxuICAgIHAgPSBAcG9pbnRzWzBdW0BlbmFibGVkX3BvaW50c11cbiAgICBwLmVuYWJsZWQgPSBmYWxzZVxuICAgIEB1cGRhdGVfZW5hYmxlZF9wb2ludHMoKVxuXG4gIHVwZGF0ZV9hdDogKHQpID0+XG4gICAgZm9yIG9yZGVyIGluIEBwb2ludHNcbiAgICAgIGZvciBwIGluIG9yZGVyXG4gICAgICAgIHAudXBkYXRlKHQpXG5cbiAgdXBkYXRlOiAtPlxuICAgIEB1cGRhdGVfYXQoQVBQLnQpXG5cbiAgZmluZF9wZW46IC0+XG4gICAgZm9yIGkgaW4gWyhAbWF4X3BvaW50cygpIC0gMSkuLjFdXG4gICAgICBwID0gQHBvaW50c1tpXVswXVxuICAgICAgaWYgcD8uZW5hYmxlZFxuICAgICAgICBicmVha1xuXG4gICAgQVBQLmRlYnVnKFwibWlzc2luZyBwZW5cIikgdW5sZXNzIHBcbiAgICBwXG5cbiAgZHJhd19jdXJ2ZTogLT5cbiAgICByZXR1cm4gdW5sZXNzIEBwb2ludHM/IGFuZCBAcG9pbnRzWzBdP1xuXG4gICAgc3RhcnQgPSBAcG9pbnRzWzBdWzBdXG5cbiAgICBwID0gQGZpbmRfcGVuKClcblxuICAgIGN0eCA9IEFQUC5ncmFwaF9jdHhcbiAgICBjdHguYmVnaW5QYXRoKClcbiAgICBjdHguc3Ryb2tlU3R5bGUgPSBwLmNvbG9yXG4gICAgY3R4LmxpbmVXaWR0aCA9IDNcblxuICAgIHQgPSAwLjBcbiAgICBAdXBkYXRlX2F0KHQpXG4gICAgY3R4Lm1vdmVUbyhwLnBvc2l0aW9uLngsIHAucG9zaXRpb24ueSlcbiAgICB3aGlsZSB0IDwgMS4wXG4gICAgICB0ICs9IDAuMDJcbiAgICAgIEB1cGRhdGVfYXQodClcbiAgICAgIGN0eC5saW5lVG8ocC5wb3NpdGlvbi54LCBwLnBvc2l0aW9uLnkpXG5cbiAgICBjdHguc3Ryb2tlKClcblxuICBkcmF3OiAtPlxuICAgIHJldHVybiB1bmxlc3MgQHBvaW50cz8gYW5kIEBwb2ludHNbMF0/XG5cbiAgICBmb3Igb3JkZXIgaW4gQHBvaW50c1xuICAgICAgZm9yIHAgaW4gb3JkZXJcbiAgICAgICAgaWYgcC5vcmRlciA+IDFcbiAgICAgICAgICBwLmRyYXcoKVxuICAgIGZvciBwIGluIEBwb2ludHNbMV1cbiAgICAgIHAuZHJhdygpXG4gICAgZm9yIHAgaW4gQHBvaW50c1swXVxuICAgICAgcC5kcmF3KClcblxuICBnZXRfbm9ybWFsOiAtPlxuICAgIHJldHVybiBudWxsIHVubGVzcyBAcGVuP1xuICAgIEB1cGRhdGVfYXQoQVBQLnQgLSBBUFAudF9zdGVwKVxuICAgIEBwZW4ucHJldl9wb3NpdGlvbi54ID0gQHBlbi5wb3NpdGlvbi54XG4gICAgQHBlbi5wcmV2X3Bvc2l0aW9uLnkgPSBAcGVuLnBvc2l0aW9uLnlcbiAgICBAdXBkYXRlKClcblxuICAgIGlmIEBwZW4ucHJldl9wb3NpdGlvbi54PyBhbmQgQHBlbi5wcmV2X3Bvc2l0aW9uLnk/XG4gICAgICBub3JtYWwgPVxuICAgICAgICB4OiAtKEBwZW4ucG9zaXRpb24ueSAtIEBwZW4ucHJldl9wb3NpdGlvbi55KVxuICAgICAgICB5OiAgKEBwZW4ucG9zaXRpb24ueCAtIEBwZW4ucHJldl9wb3NpdGlvbi54KVxuXG4gICAgICBWZWMyLm5vcm1hbGl6ZShub3JtYWwpXG4gICAgZWxzZVxuICAgICAgbnVsbFxuXG4gIGRyYXdfcGVuOiAtPlxuICAgIG5vcm1hbCA9IEBnZXRfbm9ybWFsKClcbiAgICByZXR1cm4gdW5sZXNzIG5vcm1hbD9cbiAgICBpZiBub3JtYWw/XG4gICAgICBhcnJvdyAgICAgICA9IFZlYzIuc2NhbGUobm9ybWFsLCAyMi4wKVxuICAgICAgYXJyb3d0aXAgICAgPSBWZWMyLnNjYWxlKG5vcm1hbCwgMTUuMClcbiAgICAgIGFycm93X3NoYWZ0ID0gVmVjMi5zY2FsZShub3JtYWwsIDY1LjApXG5cbiAgICAgIGFuZ2xlID0gVEFVIC8gOC4wXG4gICAgICBhcnJvd19zaWRlMSA9IFZlYzIucm90YXRlKGFycm93LCBhbmdsZSlcbiAgICAgIGFycm93X3NpZGUyID0gVmVjMi5yb3RhdGUoYXJyb3csIC1hbmdsZSlcblxuICAgICAgYXJyb3d0aXAueCArPSBAcGVuLnBvc2l0aW9uLnhcbiAgICAgIGFycm93dGlwLnkgKz0gQHBlbi5wb3NpdGlvbi55XG5cbiAgICAgIGN0eCA9IEFQUC5ncmFwaF9jdHhcbiAgICAgIGN0eC5iZWdpblBhdGgoKVxuICAgICAgY3R4Lm1vdmVUbyhhcnJvd3RpcC54LCBhcnJvd3RpcC55KVxuICAgICAgY3R4LmxpbmVUbyhhcnJvd3RpcC54ICsgYXJyb3dfc2hhZnQueCwgYXJyb3d0aXAueSArIGFycm93X3NoYWZ0LnkpXG4gICAgICBjdHgubW92ZVRvKGFycm93dGlwLngsIGFycm93dGlwLnkpXG4gICAgICBjdHgubGluZVRvKGFycm93dGlwLnggKyBhcnJvd19zaWRlMS54LCBhcnJvd3RpcC55ICsgYXJyb3dfc2lkZTEueSlcbiAgICAgIGN0eC5tb3ZlVG8oYXJyb3d0aXAueCwgYXJyb3d0aXAueSlcbiAgICAgIGN0eC5saW5lVG8oYXJyb3d0aXAueCArIGFycm93X3NpZGUyLngsIGFycm93dGlwLnkgKyBhcnJvd19zaWRlMi55KVxuICAgICAgY3R4LnN0cm9rZVN0eWxlID0gJyMwMDAwMDAnXG4gICAgICBjdHgubGluZVdpZHRoID0gMlxuICAgICAgY3R4LmxpbmVDYXAgPSBcInJvdW5kXCJcbiAgICAgIGN0eC5zdHJva2UoKVxuXG4gICAgICBwbGFiZWxfb2Zmc2V0ID0gVmVjMi5zY2FsZShWZWMyLm5vcm1hbGl6ZShhcnJvd19zaGFmdCksIEBwZW5fbGFiZWxfb2Zmc2V0X2xlbmd0aCArIDMpXG4gICAgICBwbHggPSBhcnJvd3RpcC54ICsgYXJyb3dfc2hhZnQueCArIHBsYWJlbF9vZmZzZXQueCAtIEBwZW5fbGFiZWxfb2Zmc2V0LnhcbiAgICAgIHBseSA9IGFycm93dGlwLnkgKyBhcnJvd19zaGFmdC55ICsgcGxhYmVsX29mZnNldC55IC0gQHBlbl9sYWJlbF9vZmZzZXQueSArIEBwZW5fbGFiZWxfaGVpZ2h0XG4gICAgICBjdHguZmlsbFN0eWxlID0gJyMwMDAnXG4gICAgICBjdHguZmlsbFRleHQoQHBlbl9sYWJlbCwgcGx4LCBwbHkpO1xuXG4gIGRyYXdfdGlja19hdDogKHQsIHNpemUpIC0+XG4gICAgcmV0dXJuIHVubGVzcyBAcGVuP1xuICAgIHRfc2F2ZSA9IEFQUC50XG5cbiAgICBBUFAudCA9IHRcbiAgICBub3JtYWwgPSBAZ2V0X25vcm1hbCgpXG4gICAgaWYgbm9ybWFsP1xuICAgICAgbm9ybWFsID0gVmVjMi5zY2FsZShub3JtYWwsIDMgKyAoNC4wICogc2l6ZSkpXG5cbiAgICAgIHBvaW50X2FfeCA9IEBwZW4ucG9zaXRpb24ueCArIG5vcm1hbC54XG4gICAgICBwb2ludF9hX3kgPSBAcGVuLnBvc2l0aW9uLnkgKyBub3JtYWwueVxuXG4gICAgICBwb2ludF9iX3ggPSBAcGVuLnBvc2l0aW9uLnggLSBub3JtYWwueFxuICAgICAgcG9pbnRfYl95ID0gQHBlbi5wb3NpdGlvbi55IC0gbm9ybWFsLnlcblxuICAgICAgY3R4ID0gQVBQLmdyYXBoX2N0eFxuICAgICAgY3R4LmJlZ2luUGF0aCgpXG4gICAgICBjdHgubW92ZVRvKHBvaW50X2FfeCwgcG9pbnRfYV95KVxuICAgICAgY3R4LmxpbmVUbyhwb2ludF9iX3gsIHBvaW50X2JfeSlcbiAgICAgIGN0eC5zdHJva2VTdHlsZSA9ICcjMDAwMDAwJ1xuICAgICAgY3R4LmxpbmVXaWR0aCA9IGlmIHNpemUgPiAzIHRoZW4gMiBlbHNlIDFcbiAgICAgIGN0eC5zdHJva2UoKVxuXG4gICAgQVBQLnQgPSB0X3NhdmVcblxuICBkcmF3X3RpY2tzOiAtPlxuICAgIEBwZW4gPSBAZmluZF9wZW4oKVxuXG4gICAgQGRyYXdfdGlja19hdCgwLjAsICAgICA1KVxuICAgIEBkcmF3X3RpY2tfYXQoMC4wMzEyNSwgMSlcbiAgICBAZHJhd190aWNrX2F0KDAuMDYyNSwgIDIpXG4gICAgQGRyYXdfdGlja19hdCgwLjA5Mzc1LCAxKVxuICAgIEBkcmF3X3RpY2tfYXQoMC4xMjUsICAgMylcbiAgICBAZHJhd190aWNrX2F0KDAuMTU2MjUsIDEpXG4gICAgQGRyYXdfdGlja19hdCgwLjE4NzUsICAyKVxuICAgIEBkcmF3X3RpY2tfYXQoMC4yMTg3NSwgMSlcbiAgICBAZHJhd190aWNrX2F0KDAuMjUsICAgIDQpXG4gICAgQGRyYXdfdGlja19hdCgwLjI4MTI1LCAxKVxuICAgIEBkcmF3X3RpY2tfYXQoMC4zMTI1LCAgMilcbiAgICBAZHJhd190aWNrX2F0KDAuMzQzNzUsIDEpXG4gICAgQGRyYXdfdGlja19hdCgwLjM3NSwgICAzKVxuICAgIEBkcmF3X3RpY2tfYXQoMC40MDYyNSwgMSlcbiAgICBAZHJhd190aWNrX2F0KDAuNDM3NSwgIDIpXG4gICAgQGRyYXdfdGlja19hdCgwLjQ2ODc1LCAxKVxuICAgIEBkcmF3X3RpY2tfYXQoMC41LCAgICAgNSlcbiAgICBAZHJhd190aWNrX2F0KDAuNTMxMjUsIDEpXG4gICAgQGRyYXdfdGlja19hdCgwLjU2MjUsICAyKVxuICAgIEBkcmF3X3RpY2tfYXQoMC41OTM3NSwgMSlcbiAgICBAZHJhd190aWNrX2F0KDAuNjI1LCAgIDMpXG4gICAgQGRyYXdfdGlja19hdCgwLjY1NjI1LCAxKVxuICAgIEBkcmF3X3RpY2tfYXQoMC42ODc1LCAgMilcbiAgICBAZHJhd190aWNrX2F0KDAuNzE4NzUsIDEpXG4gICAgQGRyYXdfdGlja19hdCgwLjc1LCAgICA0KVxuICAgIEBkcmF3X3RpY2tfYXQoMC43ODEyNSwgMSlcbiAgICBAZHJhd190aWNrX2F0KDAuODEyNSwgIDIpXG4gICAgQGRyYXdfdGlja19hdCgwLjg0Mzc1LCAxKVxuICAgIEBkcmF3X3RpY2tfYXQoMC44NzUsICAgMylcbiAgICBAZHJhd190aWNrX2F0KDAuOTA2MjUsIDEpXG4gICAgQGRyYXdfdGlja19hdCgwLjkzNzUsICAyKVxuICAgIEBkcmF3X3RpY2tfYXQoMC45Njg3NSwgMSlcbiAgICBAZHJhd190aWNrX2F0KDEuMCwgICAgIDUpXG5cblxuY2xhc3MgQmV6aWVyIGV4dGVuZHMgQ3VydmVcbiAgQG1pbl9wb2ludHM6IDNcbiAgQG1heF9wb2ludHM6IDhcblxuICBAaW5pdGlhbF9wb2ludHM6IFtcbiAgICBbIDAuMDYsIDAuODIgXSxcbiAgICBbIDAuNzIsIDAuMTggXVxuICBdXG5cbiAgY29uc3RydWN0b3I6IC0+XG4gICAgc3VwZXJcbiAgICBAYWxsb2NfcG9pbnRzKClcblxuICB0X21pbjogLT5cbiAgICAwLjBcblxuICB0X21heDogLT5cbiAgICAxLjBcblxuICBhZGRfc2VnbWVudDogLT5cbiAgICBBUFAuYXNzZXJ0X25ldmVyX3JlYWNoZWQoKVxuXG4gIHN1Yl9zZWdtZW50OiAtPlxuICAgIEFQUC5hc3NlcnRfbmV2ZXJfcmVhY2hlZCgpXG5cbiAgYWxsb2NfcG9pbnRzOiAtPlxuICAgIEBwb2ludHNbMF0gPSBbXVxuXG4gICAgZm9yIGkgaW4gWzAuLkBtYXhfcG9pbnRzKCldXG4gICAgICBAcG9pbnRzWzBdW2ldID0gbmV3IFBvaW50KClcbiAgICAgIEBwb2ludHNbMF1baV0uc2V0X2xhYmVsKCBMRVJQaW5nU3BsaW5lcy5wb2ludF9sYWJlbHNbaV0gKVxuXG4gICAgQGFkZF9sZXJwcygpXG5cbiAgYnVpbGQ6IC0+XG4gICAgQHJlc2V0KClcblxuICAgIGluaXRpYWxfcG9pbnRzID0gQGNvbnN0cnVjdG9yLmluaXRpYWxfcG9pbnRzXG4gICAgbWFyZ2luID0gTEVSUGluZ1NwbGluZXMuY3JlYXRlX3BvaW50X21hcmdpblxuICAgIHJhbmdlID0gMS4wIC0gKDIuMCAqIG1hcmdpbilcblxuICAgIEByZXNldF9wb2ludHMoKVxuXG4gICAgZm9yIHBvaW50IGluIGluaXRpYWxfcG9pbnRzXG4gICAgICBAZW5hYmxlX3BvaW50X2F0KCBwb2ludFswXSwgcG9pbnRbMV0gKVxuXG4gICAgQHVwZGF0ZV9lbmFibGVkX3BvaW50cygpXG5cbiAgICBjb25zb2xlLmxvZygnSW5pdGlhbCBwb2ludHMgY3JlYXRlZCEnKVxuXG4gIG9yZGVyX3VwX3JlYmFsYW5jZTogLT5cbiAgICBjdXJfaWQgPSBAZW5hYmxlZF9wb2ludHNcbiAgICBwcmV2X2lkID0gY3VyX2lkIC0gMVxuICAgIHdoaWxlIHByZXZfaWQgPj0gMFxuICAgICAgY3VyICA9IEBwb2ludHNbMF1bY3VyX2lkXVxuICAgICAgcHJldiA9IEBwb2ludHNbMF1bcHJldl9pZF1cblxuICAgICAgayA9IEBlbmFibGVkX3BvaW50c1xuXG4gICAgICB4ID0gKChrIC0gY3VyX2lkKSAvIGspICogY3VyLnBvc2l0aW9uLnggKyAoY3VyX2lkIC8gaykgKiBwcmV2LnBvc2l0aW9uLnhcbiAgICAgIHkgPSAoKGsgLSBjdXJfaWQpIC8gaykgKiBjdXIucG9zaXRpb24ueSArIChjdXJfaWQgLyBrKSAqIHByZXYucG9zaXRpb24ueVxuXG4gICAgICBjdXIubW92ZSh4LCB5KVxuXG4gICAgICBjdXJfaWQtLVxuICAgICAgcHJldl9pZC0tXG5cbiAgY29tcHV0ZV9sb3dlcl9vcmRlcl9jdXJ2ZTogLT5cbiAgICBwb2ludHMgPSBAcG9pbnRzWzBdLm1hcCAocG9pbnQpIC0+XG4gICAgICByZXR1cm5cbiAgICAgICAgeDogcG9pbnQucG9zaXRpb24ueFxuICAgICAgICB5OiBwb2ludC5wb3NpdGlvbi55XG5cbiAgICBgLyogY29waWVkIGZyb206IGh0dHBzOi8vcG9tYXguZ2l0aHViLmlvL2JlemllcmluZm8vY2hhcHRlcnMvcmVvcmRlcmluZy9yZW9yZGVyLmpzICovXG5cbiAgICAvLyBCYXNlZCBvbiBodHRwczovL3d3dy5zaXJ2ZXIubmV0L2Jsb2cvMjAxMS8wOC8yMy9kZWdyZWUtcmVkdWN0aW9uLW9mLWJlemllci1jdXJ2ZXMvXG5cbiAgICAvLyBUT0RPOiBGSVhNRTogdGhpcyBpcyB0aGUgc2FtZSBjb2RlIGFzIGluIHRoZSBvbGQgY29kZWJhc2UsXG4gICAgLy8gICAgICAgICAgICAgIGFuZCBpdCBkb2VzIHNvbWV0aGluZyBvZGQgdG8gdGhlIGVpdGhlciB0aGVcbiAgICAvLyAgICAgICAgICAgICAgZmlyc3Qgb3IgbGFzdCBwb2ludC4uLiBpdCBzdGFydHMgdG8gdHJhdmVsXG4gICAgLy8gICAgICAgICAgICAgIEEgTE9UIG1vcmUgdGhhbiBpdCBsb29rcyBsaWtlIGl0IHNob3VsZC4uLiBPX29cblxuICAgIHAgPSBwb2ludHMsXG4gICAgayA9IHAubGVuZ3RoLFxuICAgIGRhdGEgPSBbXSxcbiAgICBuID0gay0xO1xuXG4gICAgLy9pZiAoayA8PSAzKSByZXR1cm47XG5cbiAgICAvLyBidWlsZCBNLCB3aGljaCB3aWxsIGJlIChrKSByb3dzIGJ5IChrLTEpIGNvbHVtbnNcbiAgICBmb3IobGV0IGk9MDsgaTxrOyBpKyspIHtcbiAgICAgIGRhdGFbaV0gPSAobmV3IEFycmF5KGsgLSAxKSkuZmlsbCgwKTtcbiAgICAgIGlmKGk9PT0wKSB7IGRhdGFbaV1bMF0gPSAxOyB9XG4gICAgICBlbHNlIGlmKGk9PT1uKSB7IGRhdGFbaV1baS0xXSA9IDE7IH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBkYXRhW2ldW2ktMV0gPSBpIC8gaztcbiAgICAgICAgZGF0YVtpXVtpXSA9IDEgLSBkYXRhW2ldW2ktMV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXBwbHkgb3VyIG1hdHJpeCBvcGVyYXRpb25zOlxuICAgIGNvbnN0IE0gPSBuZXcgTWF0cml4KGRhdGEpO1xuICAgIGNvbnN0IE10ID0gTS50cmFuc3Bvc2UoTSk7XG4gICAgY29uc3QgTWMgPSBNdC5tdWx0aXBseShNKTtcbiAgICBjb25zdCBNaSA9IE1jLmludmVydCgpO1xuXG4gICAgaWYgKCFNaSkge1xuICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoJ010TSBoYXMgbm8gaW52ZXJzZT8nKTtcbiAgICB9XG5cbiAgICAvLyBBbmQgdGhlbiB3ZSBtYXAgb3VyIGstb3JkZXIgbGlzdCBvZiBjb29yZGluYXRlc1xuICAgIC8vIHRvIGFuIG4tb3JkZXIgbGlzdCBvZiBjb29yZGluYXRlcywgaW5zdGVhZDpcbiAgICBjb25zdCBWID0gTWkubXVsdGlwbHkoTXQpO1xuICAgIGNvbnN0IHggPSBuZXcgTWF0cml4KHBvaW50cy5tYXAocCA9PiBbcC54XSkpO1xuICAgIGNvbnN0IG54ID0gVi5tdWx0aXBseSh4KTtcbiAgICBjb25zdCB5ID0gbmV3IE1hdHJpeChwb2ludHMubWFwKHAgPT4gW3AueV0pKTtcbiAgICBjb25zdCBueSA9IFYubXVsdGlwbHkoeSk7XG5cbiAgICBwb2ludHMgPSBueC5kYXRhLm1hcCgoeCxpKSA9PiAoe1xuICAgICAgeDogeFswXSxcbiAgICAgIHk6IG55LmRhdGFbaV1bMF1cbiAgICB9KSk7YFxuXG4gICAgZm9yIGkgaW4gWzAuLi5wb2ludHMubGVuZ3RoXVxuICAgICAgcCA9IEFQUC5jbGFtcF90b19jYW52YXMocG9pbnRzW2ldKVxuICAgICAgQHBvaW50c1swXVtpXS5tb3ZlKHAueCwgcC55KVxuXG4gIGdldF9hbGdvcml0aG1fdGV4dDogLT5cbiAgICBsaW5lcyA9IFtdXG4gICAgZm9yIG9yZGVyIGluIFswLi4oQGVuYWJsZWRfcG9pbnRzIC0gMSldXG4gICAgICBpZiBvcmRlciA+IDBcbiAgICAgICAgbGluZXMucHVzaCBcIlwiXG4gICAgICAgIGxpbmVzLnB1c2ggXCIjIyMgT3JkZXIgI3tvcmRlcn0gQmV6aWVyXCJcbiAgICAgIGVsc2VcbiAgICAgICAgbGluZXMucHVzaCBcIiMjIyBQb2ludHNcIlxuXG4gICAgICBmb3IgcCBpbiBAcG9pbnRzW29yZGVyXVxuICAgICAgICBjb250aW51ZSB1bmxlc3MgcC5lbmFibGVkXG5cbiAgICAgICAgbGFiZWwgPSBpZiBwIGlzIEBwZW4gdGhlbiBAcGVuX2xhYmVsIGVsc2UgcC5nZXRfbGFiZWwoKVxuXG4gICAgICAgIGlmIEFQUC5vcHRpb24uYWx0X2FsZ29yaXRobV9uYW1lcy52YWx1ZVxuICAgICAgICAgICMgYWx0XG4gICAgICAgICAgc3dpdGNoIG9yZGVyXG4gICAgICAgICAgICB3aGVuIDBcbiAgICAgICAgICAgICAgbGluZXMucHVzaCBcIiN7bGFiZWx9ID0gPCN7cGFyc2VJbnQocC5wb3NpdGlvbi54LCAxMCl9LCAje3BhcnNlSW50KHAucG9zaXRpb24ueSwgMTApfT5cIlxuXG4gICAgICAgICAgICB3aGVuIDZcbiAgICAgICAgICAgICAgaWYgbGFiZWwubGVuZ3RoIDwgNFxuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2ggXCIje2xhYmVsfSA9IExlcnAoI3twLmZyb20uZ2V0X2xhYmVsKCl9LCAje3AudG8uZ2V0X2xhYmVsKCl9LCB0KVwiXG5cbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2ggXCIje2xhYmVsfSA9XCJcbiAgICAgICAgICAgICAgICBsaW5lcy5wdXNoIFwiICAgIExlcnAoI3twLmZyb20uZ2V0X2xhYmVsKCl9LFwiXG4gICAgICAgICAgICAgICAgbGluZXMucHVzaCBcIiAgICAgICAgICN7cC50by5nZXRfbGFiZWwoKX0sIHQpXCJcblxuICAgICAgICAgICAgd2hlbiA3XG4gICAgICAgICAgICAgIGlmIGxhYmVsLmxlbmd0aCA8IDRcbiAgICAgICAgICAgICAgICBsaW5lcy5wdXNoIFwiI3tsYWJlbH0gPSBMZXJwKCN7cC5mcm9tLmdldF9sYWJlbCgpfSxcIlxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgbGluZXMucHVzaCBcIiN7bGFiZWx9ID1cIlxuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2ggXCIgICAgTGVycCgje3AuZnJvbS5nZXRfbGFiZWwoKX0sXCJcblxuICAgICAgICAgICAgICBsaW5lcy5wdXNoIFwiICAgICAgICAgI3twLnRvLmdldF9sYWJlbCgpfSxcIlxuICAgICAgICAgICAgICBsaW5lcy5wdXNoIFwiICAgICAgICAgdClcIlxuXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIGxpbmVzLnB1c2ggXCIje2xhYmVsfSA9IExlcnAoI3twLmZyb20uZ2V0X2xhYmVsKCl9LCAje3AudG8uZ2V0X2xhYmVsKCl9LCB0KVwiXG5cbiAgICAgICAgZWxzZVxuICAgICAgICAgICMgbm9ybWFsXG4gICAgICAgICAgaWYgb3JkZXIgPiAwXG4gICAgICAgICAgICBsaW5lcy5wdXNoIFwiI3tsYWJlbH0gPSBMZXJwKCN7cC5mcm9tLmdldF9sYWJlbCgpfSwgI3twLnRvLmdldF9sYWJlbCgpfSwgdClcIlxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGxpbmVzLnB1c2ggXCIje2xhYmVsfSA9IDwje3BhcnNlSW50KHAucG9zaXRpb24ueCwgMTApfSwgI3twYXJzZUludChwLnBvc2l0aW9uLnksIDEwKX0+XCJcblxuICAgIGxpbmVzLmpvaW4oXCJcXG5cIilcblxuY2xhc3MgU3BsaW5lIGV4dGVuZHMgQ3VydmVcbiAgQG1pbl9vcmRlcjogMVxuICBAbWF4X29yZGVyOiAzXG4gIEBtaW5fc2VnbWVudHM6IDFcbiAgQG1heF9zZWdtZW50czogNFxuXG4gIEBpbml0aWFsX3BvaW50czogW1xuICAgIFsgMC4wNiwgMC44MiBdLFxuICAgIFsgMC4xNSwgMC4wOCBdLFxuICAgIFsgMC43MiwgMC4xOCBdLFxuICAgIFsgMC44OCwgMC45MCBdLFxuICAgIFsgMC40MywgMC44NCBdXG4gIF1cblxuICBjb25zdHJ1Y3RvcjogLT5cbiAgICBzdXBlclxuXG4gICAgQG9yZGVyID0gLTFcbiAgICBAc2VnbWVudF9jb3VudCA9IC0xXG5cbiAgICBAc2VnbWVudCA9IFtdXG5cbiAgICBAYWxsb2NfcG9pbnRzKClcblxuICBsb2c6IC0+XG4gICAgY29uc29sZS5sb2coXCIvLy8gU3BsaW5lIFN0YXRlOiBvcmRlcj0je0BvcmRlcn0gc2VnbWVudF9jb3VudD0je0BzZWdtZW50X2NvdW50fVwiKVxuICAgIGNvbnNvbGUubG9nKFwiICAgICAgICAgICAgICAgICAgcG9pbnRzLmxlbmd0aD0je0Bwb2ludHMubGVuZ3RofSBzZWdtZW50Lmxlbmd0aD0je0BzZWdtZW50Lmxlbmd0aH1cIilcbiAgICBjb25zb2xlLmxvZygncG9pbnRzJylcbiAgICBjb25zb2xlLmxvZyhAcG9pbnRzKVxuICAgIGNvbnNvbGUubG9nKCdzZWdtZW50cycpXG4gICAgY29uc29sZS5sb2coQHNlZ21lbnQpXG4gICAgY29uc29sZS5sb2coXCJcXFxcXFxcXFxcXFwgU3BsaW5lIFN0YXRlIEVuZFwiKVxuXG4gIHJlc2V0OiAtPlxuICAgIHN1cGVyXG4gICAgQG9yZGVyID0gLTFcbiAgICBAc2VnbWVudF9jb3VudCA9IC0xXG4gICAgQHNlZ21lbnQgPSBbXVxuXG4gIHRfbWluOiAtPlxuICAgIDAuMFxuXG4gIHRfbWF4OiAtPlxuICAgIEBzZWdtZW50X2NvdW50IC0gMVxuXG4gIHNldF90X3NlZ21lbnQ6ICh2YWx1ZSkgLT5cbiAgICBAdF9zZWdtZW50ID0gdmFsdWVcblxuICBjdXJyZW50X3NlZ21lbnQ6IC0+XG4gICAgaWYgQVBQLnRfcmVhbCA9PSBAdF9tYXgoKVxuICAgICAgQHNlZ21lbnRbQHRfc2VnbWVudC0xXVxuICAgIGVsc2VcbiAgICAgIEBzZWdtZW50W0B0X3NlZ21lbnRdXG5cbiAgbWluX3BvaW50czogLT5cbiAgICBAbWluX29yZGVyKCkgKyAxXG5cbiAgbWF4X3BvaW50czogLT5cbiAgICAoQG1heF9vcmRlcigpICogQG1heF9zZWdtZW50cygpKSArIDFcblxuICBjdXJyZW50X21heF9wb2ludHM6IC0+XG4gICAgKEBvcmRlciAqIEBzZWdtZW50X2NvdW50KSArIDFcblxuICBtaW5fc2VnbWVudHM6IC0+XG4gICAgQGNvbnN0cnVjdG9yLm1pbl9zZWdtZW50c1xuXG4gIG1heF9zZWdtZW50czogLT5cbiAgICBAY29uc3RydWN0b3IubWF4X3NlZ21lbnRzXG5cbiAgbWluX29yZGVyOiAtPlxuICAgIEBjb25zdHJ1Y3Rvci5taW5fb3JkZXJcblxuICBtYXhfb3JkZXI6IC0+XG4gICAgQGNvbnN0cnVjdG9yLm1heF9vcmRlclxuXG4gIGVuYWJsZV9wb2ludDogKHJlYmFsYW5jZV9wb2ludHMpIC0+XG4gICAgQVBQLmFzc2VydF9uZXZlcl9yZWFjaGVkKClcblxuICBkaXNhYmxlX3BvaW50OiAocmViYWxhbmNlX3BvaW50cykgLT5cbiAgICBBUFAuYXNzZXJ0X25ldmVyX3JlYWNoZWQoKVxuXG4gIGFsbG9jX3BvaW50czogKCkgLT5cbiAgICBAcG9pbnRzWzBdID0gW11cbiAgICBwcmV2ID0gbnVsbFxuICAgIGZvciBpIGluIFswLi5AbWF4X3BvaW50cygpXVxuICAgICAgQHBvaW50c1tpXSA9IG5ldyBQb2ludCgpXG4gICAgICAjQHBvaW50c1tpXS5zZXRfbGFiZWwoIExFUlBpbmdTcGxpbmVzLnBvaW50X2xhYmVsc1tpXSApXG4gICAgICBpZiBwcmV2P1xuICAgICAgICBwcmV2Lm5leHQgPSBAcG9pbnRzW2ldXG4gICAgICAgIEBwb2ludHNbaV0ucHJldiA9IHByZXZcbiAgICAgIHByZXYgPSBAcG9pbnRzW2ldXG5cbiAgam9pbmluZ19wb2ludHNfZm9yX29yZGVyOiAob3JkZXIpIC0+XG4gICAgbiA9IDBcbiAgICBwb2ludHMgPSBbXVxuICAgIGZvciBwIGluIEBlYWNoX3BvaW50KClcbiAgICAgIGlmIG4gPCAyXG4gICAgICAgIHBvaW50cy5wdXNoKHAucG9zaXRpb24pXG4gICAgICAgIG4gPSBvcmRlclxuICAgICAgbi0tXG5cbiAgbmV3X3NlZ21lbnQ6IC0+XG4gICAgc2VnbWVudCA9IG5ldyBCZXppZXIoKVxuICAgIHNlZ21lbnQuZGlzYWJsZV91aSgpXG4gICAgc2VnbWVudFxuXG4gIGJ1aWxkOiAob3JkZXIsIHNjKSAtPlxuICAgIEByZXNldCgpXG5cbiAgICBAb3JkZXIgPSBvcmRlclxuICAgIEBzZWdtZW50X2NvdW50ID0gc2NcblxuICAgIGluaXRpYWxfcG9pbnRzID0gQGNvbnN0cnVjdG9yLmluaXRpYWxfcG9pbnRzXG5cbiAgICB1bmxlc3MgaW5pdGlhbF9wb2ludHM/XG4gICAgICBpbml0aWFsX3BvaW50cyA9IEBqb2luaW5nX3BvaW50c19mb3Jfb3JkZXIoQG9yZGVyKVxuICAgICAgY29uc29sZS5sb2coJ2luaXRpYWxfcG9pbnRzJywgaW5pdGlhbF9wb2ludHMpXG5cbiAgICBAZW5hYmxlZF9wb2ludHMgPSAwXG4gICAgdW5sZXNzIEBtaW5fc2VnbWVudHMoKSA8PSBAc2VnbWVudF9jb3VudCA8PSBAbWF4X3NlZ21lbnRzKClcbiAgICAgIEFQUC5mYXRhbF9lcnJvcihcImJhZCBAc2VnbWVudF9jb3VudCB2YWx1ZTogI3tAc2VnbWVudF9jb3VudH1cIilcbiAgICBmb3IgaW5kZXggaW4gWzAuLkBzZWdtZW50X2NvdW50XVxuICAgICAgcG9pbnQgPSBpbml0aWFsX3BvaW50c1tpbmRleF1cbiAgICAgIHBpZHggPSBpbmRleCAqIEBvcmRlclxuICAgICAgI2NvbnNvbGUubG9nKFwiPj5waWR4PSN7cGlkeH0gbGFiZWw9XFxcIiN7TEVSUGluZ1NwbGluZXMucG9pbnRfbGFiZWxzW2luZGV4XX1cXFwiXCIpXG4gICAgICBAcG9pbnRzW3BpZHhdLmVuYWJsZWQgPSB0cnVlXG4gICAgICBAZW5hYmxlZF9wb2ludHMgKz0gMVxuICAgICAgQHBvaW50c1twaWR4XS5zZXRfZnJhY3RfcG9zaXRpb24ocG9pbnRbMF0sIHBvaW50WzFdKVxuICAgICAgQHBvaW50c1twaWR4XS5zZXRfbGFiZWwoIExFUlBpbmdTcGxpbmVzLnBvaW50X2xhYmVsc1tpbmRleF0gKVxuICAgICAgQHBvaW50c1twaWR4XS5rbm90ID0gdHJ1ZVxuXG4gICAgICBpZiBpbmRleCA+IDBcbiAgICAgICAgZm9yIGogaW4gWzEuLihAb3JkZXItMSldXG4gICAgICAgICAgY2lkeCA9IHBpZHggLSBAb3JkZXIgKyBqXG4gICAgICAgICAgcHJldiA9IEBwb2ludHNbcGlkeCAtIEBvcmRlcl1cbiAgICAgICAgICBuZXh0ID0gQHBvaW50c1twaWR4XVxuICAgICAgICAgIHBvcyA9IFZlYzIubGVycChwcmV2LCBuZXh0LCBqIC8gQG9yZGVyKVxuICAgICAgICAgIEBwb2ludHNbY2lkeF0uZW5hYmxlZCA9IHRydWVcbiAgICAgICAgICBAZW5hYmxlZF9wb2ludHMgKz0gMVxuICAgICAgICAgIEBwb2ludHNbY2lkeF0ueCA9IHBvcy54XG4gICAgICAgICAgQHBvaW50c1tjaWR4XS55ID0gcG9zLnlcbiAgICAgICAgICBsYWJlbCA9IFwiI3twcmV2LmxhYmVsfSN7bmV4dC5sYWJlbH0je2p9XCJcbiAgICAgICAgICBAcG9pbnRzW2NpZHhdLnNldF9sYWJlbCggbGFiZWwgKVxuICAgICAgICAgIEBwb2ludHNbY2lkeF0uc2hvd19sYWJlbCA9IGZhbHNlXG4gICAgICAgICAgI2NvbnNvbGUubG9nKFwiICBjaWR4PSN7Y2lkeH0gbGFiZWw9XFxcIiN7bGFiZWx9XFxcIlwiKVxuICAgICAgICAgIEBwb2ludHNbY2lkeF0ua25vdCA9IGZhbHNlXG5cbiAgICAjY29uc29sZS5sb2coXCJyZWJ1aWxkaW5nIHNwbGluZSB3aXRoIHVwIHRvICN7QG1heF9zZWdtZW50cygpfSBzZWdtZW50ZVwiKVxuICAgIEBlbmFibGVkX3NlZ21lbnRzID0gMFxuICAgIGZvciBpIGluIFswLi5AbWF4X3NlZ21lbnRzKCldXG4gICAgICBzdGFydF9pZHggPSAoaSAqIEBvcmRlcilcbiAgICAgIGVuZF9pZHggPSBzdGFydF9pZHggKyBAb3JkZXIgKyAxXG4gICAgICBicmVhayBpZiBlbmRfaWR4ID49IEBjdXJyZW50X21heF9wb2ludHMoKVxuICAgICAgI2NvbnNvbGUubG9nKFwiZ2l2aW5nIHNlZ21lbnQgI3tpfSBwb2ludHMgI3tzdGFydF9pZHh9IC0+ICN7ZW5kX2lkeCAtIDF9XCIpXG4gICAgICBzZWdfcG9pbnRzID0gQHBvaW50cy5zbGljZShzdGFydF9pZHgsIGVuZF9pZHgpXG4gICAgICAjY29uc29sZS5sb2coXCIgIC0+IFsgI3tzZWdfcG9pbnRzLm1hcCggKHgpIC0+IFwiXFxcIiN7eC5sYWJlbH1cXFwiXCIgKS5qb2luKCcsICcpfSBdXCIpXG4gICAgICBAc2VnbWVudFtpXSA9IEBuZXdfc2VnbWVudCgpXG4gICAgICBAc2VnbWVudFtpXS5zZXRfcG9pbnRzKCBzZWdfcG9pbnRzIClcbiAgICAgIEBzZWdtZW50W2ldLmVuYWJsZWQgPSB0cnVlO1xuICAgICAgZm9yIHAgaW4gc2VnX3BvaW50c1xuICAgICAgICB1bmxlc3MgcC5lbmFibGVkXG4gICAgICAgICAgQHNlZ21lbnRbaV0uZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrXG5cbiAgICAgIGlmIEBzZWdtZW50W2ldLmVuYWJsZWRcbiAgICAgICAgQGVuYWJsZWRfc2VnbWVudHMgKz0gMVxuXG4gICAgQGV4cGVjdGVkX3BvaW50cyAgPSAxICAgICAgICAgICAgICAgICMgc3RhcnRpbmcga25vdFxuICAgIEBleHBlY3RlZF9wb2ludHMgKz0gQHNlZ21lbnRfY291bnQgICAjIGtub3QgYXQgdGhlIGVuZCBvZiBlYWNoIHNlZ21lbnRcbiAgICBAZXhwZWN0ZWRfcG9pbnRzICs9IEBzZWdtZW50X2NvdW50ICogKEBvcmRlciAtIDEpICAjIGNvbnRyb2wgcG9pbnRzIGJldHdlZW4ga25vdHNcblxuICAgIGlmIEBleHBlY3RlZF9wb2ludHMgIT0gQGVuYWJsZWRfcG9pbnRzXG4gICAgICBBUFAuZmF0YWxfZXJyb3IoXCJXcm9uZyBudW1iZXIgb2YgZW5hYmxlZCBwb2ludHMhIEV4cGVjdGVkICN7QGV4cGVjdGVkX3BvaW50c30sIGhhdmUgZW5hYmxlZCAje0BlbmFibGVkX3BvaW50c30gKG9yZGVyPSN7QG9yZGVyfSBzZWdtZW50X2NvdW50PSN7QHNlZ21lbnRfY291bnR9XCIpXG5cbiAgICBAbWlycm9yX2tub3RfbmVpZ2hib3JzKClcblxuICBtaXJyb3Jfa25vdF9uZWlnaGJvcnM6IC0+XG4gICAgZm9yIHAgZnJvbSBAZWFjaF9rbm90KClcbiAgICAgIGNvbnRpbnVlIHVubGVzcyBwLnByZXY/IGFuZCBwLm5leHQ/IGFuZCBwLnByZXYuZW5hYmxlZCBhbmQgcC5uZXh0LmVuYWJsZWRcblxuICAgICAgZGVsdGEgPSBWZWMyLnN1YihwLm5leHQsIHApXG4gICAgICBuZXdfcHJldiA9IFZlYzIuc3ViKHAsIGRlbHRhKVxuICAgICAgYXZnX3ByZXYgPSBWZWMyLmxlcnAocC5wcmV2LCBuZXdfcHJldiwgMC41KVxuICAgICAgcC5wcmV2LnggPSBhdmdfcHJldi54XG4gICAgICBwLnByZXYueSA9IGF2Z19wcmV2LnlcblxuICAgICAgZGVsdGEgPSBWZWMyLnN1YihwLnByZXYsIHApXG4gICAgICBwLm5leHQueCA9IHAueCAtIGRlbHRhLnhcbiAgICAgIHAubmV4dC55ID0gcC55IC0gZGVsdGEueVxuXG4gIGVhY2hfa25vdDogLT5cbiAgICByZXR1cm4gdW5sZXNzIEBzZWdtZW50P1xuICAgIGZpcnN0ID0gdHJ1ZVxuICAgIGZvciBzIGluIEBzZWdtZW50XG4gICAgICBmb3IgcCBmcm9tIHMuZWFjaF9wb2ludChmaXJzdClcbiAgICAgICAgeWllbGQgcCBpZiBwLmtub3RcbiAgICAgIGZpcnN0ID0gZmFsc2VcblxuICBlYWNoX3BvaW50OiAtPlxuICAgIHJldHVybiB1bmxlc3MgQHNlZ21lbnQ/XG4gICAgZmlyc3QgPSB0cnVlXG4gICAgZm9yIHMgaW4gQHNlZ21lbnRcbiAgICAgIGZvciBwIGZyb20gcy5lYWNoX3BvaW50KGZpcnN0KVxuICAgICAgICB5aWVsZCBwXG4gICAgICBmaXJzdCA9IGZhbHNlXG5cbiAgZmluZF9wb2ludDogKHgsIHkpIC0+XG4gICAgZm9yIHMgaW4gQHNlZ21lbnRcbiAgICAgIHAgPSBzLmZpbmRfcG9pbnQoeCwgeSlcbiAgICAgIHJldHVybiBwIGlmIHA/XG4gICAgcmV0dXJuIG51bGxcblxuICBjYWxsX29uX2VhY2hfc2VnbWVudDogKGZ1bmNfbmFtZSkgLT5cbiAgICBzID0gQGN1cnJlbnRfc2VnbWVudCgpXG4gICAgQHBlbiA9IHMucGVuIGlmIHM/XG5cbiAgICBmb3IgcyBpbiBAc2VnbWVudFxuICAgICAgaWYgcz8uZW5hYmxlZFxuICAgICAgICBzW2Z1bmNfbmFtZV0oKVxuXG4gIHVwZGF0ZV9hdDogKHQpID0+XG4gICAgcyA9IEBjdXJyZW50X3NlZ21lbnQoKVxuICAgIGlmIHM/XG4gICAgICBzLnVwZGF0ZV9hdCh0KVxuXG4gIHVwZGF0ZTogLT5cbiAgICBAY2FsbF9vbl9lYWNoX3NlZ21lbnQoJ3VwZGF0ZScpXG5cbiAgZHJhd19jdXJ2ZTogLT5cbiAgICBAY2FsbF9vbl9lYWNoX3NlZ21lbnQoJ2RyYXdfY3VydmUnKVxuXG4gIGRyYXdfdGlja3M6IC0+XG4gICAgQGNhbGxfb25fZWFjaF9zZWdtZW50KCdkcmF3X3RpY2tzJylcblxuICBkcmF3X3BlbjogLT5cbiAgICBzID0gQGN1cnJlbnRfc2VnbWVudCgpXG4gICAgaWYgcz9cbiAgICAgIHMuZHJhd19wZW4oKVxuXG4gIGRyYXc6IC0+XG4gICAgQGNhbGxfb25fZWFjaF9zZWdtZW50KCdkcmF3JylcblxuICBnZXRfYWxnb3JpdGhtX3RleHQ6IC0+XG4gICAgJydcblxuY2xhc3MgTWF0cml4U3BsaW5lU2VnbWVudFxuICBjb25zdHJ1Y3RvcjogLT5cblxuICBzZXRfcG9pbnRzOiAocG9pbnRzKSAtPlxuICAgIEBwb2ludHMgPSBwb2ludHNcblxuICBlYWNoX3BvaW50OiAoaW5jbHVkZV9maXJzdCA9IHRydWUpIC0+XG4gICAgZmlyc3QgPSB0cnVlXG4gICAgZm9yIHAgaW4gQHBvaW50c1xuICAgICAgaWYgZmlyc3RcbiAgICAgICAgZmlyc3QgPSBmYWxzZVxuICAgICAgICB5aWVsZCBwIGlmIGluY2x1ZGVfZmlyc3RcbiAgICAgIGVsc2VcbiAgICAgICAgeWllbGQgcFxuICAgIHJldHVyblxuXG4gIGZpbmRfcG9pbnQ6ICh4LCB5KSAtPlxuICAgIGZvciBwIGZyb20gQGVhY2hfcG9pbnQoKVxuICAgICAgaWYgcD8uY29udGFpbnMoeC4geSlcbiAgICAgICAgcmV0dXJuIHBcbiAgICByZXR1cm4gbnVsbFxuXG4gIGRyYXdfaGFuZGxlczogLT5cbiAgICBjdHggPSBBUFAuZ3JhcGhfY3R4XG4gICAgY3R4LmJlZ2luUGF0aCgpXG4gICAgY3R4LmxpbmVXaWR0aCA9IDJcbiAgICAjY3R4LnN0cm9rZVN0eWxlID0gJyM3Nzc3NzcnXG4gICAgY3R4LnN0cm9rZVN0eWxlID0gJyM2NjY2NjYnXG4gICAgY3R4Lmdsb2JhbE9wYWNpdHkgPSAxLjBcblxuICAgIGlmIEBwb2ludHNbMF0/IGFuZCBAcG9pbnRzWzFdP1xuICAgICAgY3R4Lm1vdmVUbyhAcG9pbnRzWzBdLngsIEBwb2ludHNbMF0ueSlcbiAgICAgIGN0eC5saW5lVG8oQHBvaW50c1sxXS54LCBAcG9pbnRzWzFdLnkpXG4gICAgaWYgQHBvaW50c1syXT8gYW5kIEBwb2ludHNbM10/XG4gICAgICBjdHgubW92ZVRvKEBwb2ludHNbM10ueCwgQHBvaW50c1szXS55KVxuICAgICAgY3R4LmxpbmVUbyhAcG9pbnRzWzJdLngsIEBwb2ludHNbMl0ueSlcblxuICAgIGN0eC5zZXRMaW5lRGFzaChbMyw1XSlcbiAgICBjdHguc3Ryb2tlKClcbiAgICBjdHguc2V0TGluZURhc2goW10pXG5cbiAgdXBkYXRlX2F0OiAodCkgLT5cbiAgICBmb3IgcCBmcm9tIEBlYWNoX3BvaW50KClcbiAgICAgIHAudXBkYXRlKHQpXG5cbiAgdXBkYXRlOiAtPlxuICAgIEB1cGRhdGVfYXQoQVBQLnQpXG5cbiAgZHJhdzogLT5cbiAgICBAZHJhd19oYW5kbGVzKClcbiAgICBmb3IgcCBmcm9tIEBlYWNoX3BvaW50KClcbiAgICAgIHAuZHJhdygpXG5cbiAgZ2V0X2N1YmljX2Rlcml2YXRpdmU6ICh0KSAtPlxuICAgIG10ID0gMSAtIHRcbiAgICBhID0gbXQgKiBtdFxuICAgIGIgPSAyICogbXQgKiB0XG4gICAgYyA9IHQqdFxuICAgIGQweCA9IDMgKiAoQHBvaW50c1sxXS54IC0gQHBvaW50c1swXS54KVxuICAgIGQweSA9IDMgKiAoQHBvaW50c1sxXS55IC0gQHBvaW50c1swXS55KVxuICAgIGQxeCA9IDMgKiAoQHBvaW50c1syXS54IC0gQHBvaW50c1sxXS54KVxuICAgIGQxeSA9IDMgKiAoQHBvaW50c1syXS55IC0gQHBvaW50c1sxXS55KVxuICAgIGQyeCA9IDMgKiAoQHBvaW50c1szXS54IC0gQHBvaW50c1syXS54KVxuICAgIGQyeSA9IDMgKiAoQHBvaW50c1szXS55IC0gQHBvaW50c1syXS55KVxuICAgIHJldHVyblxuICAgICAgeDogYSAqIGQweCArIGIgKiBkMXggKyBjICogZDJ4LFxuICAgICAgeTogYSAqIGQweSArIGIgKiBkMXkgKyBjICogZDJ5XG5cbiAgZ2V0X25vcm1hbDogKHQpIC0+XG4gICAgZCA9IEBnZXRfY3ViaWNfZGVyaXZhdGl2ZSh0KVxuICAgIG0gPSBNYXRoLnNxcnQoZC54ICogZC54ICsgZC55ICogZC55KVxuICAgIGQueCA9IGQueCAvIG1cbiAgICBkLnkgPSBkLnkgLyBtXG4gICAgcSA9IE1hdGguc3FydChkLnggKiBkLnggKyBkLnkgKiBkLnkpXG4gICAgcmV0dXJuXG4gICAgICB4OiAtZC55IC8gcVxuICAgICAgeTogIGQueCAvIHFcblxuY2xhc3MgTWF0cml4U3BsaW5lIGV4dGVuZHMgU3BsaW5lXG4gIEBkZWZhdWx0X21hdHJpeDogJ2JlemllcidcbiAgI0BkZWZhdWx0X21hdHJpeDogJ2hlcm1pdGUnXG4gICNAZGVmYXVsdF9tYXRyaXg6ICdjYXRtdWxscm9tJ1xuICAjQGRlZmF1bHRfbWF0cml4OiAnYnNwbGluZSdcbiAgQHR5cGU6XG4gICAgYmV6aWVyOlxuICAgICAgbmFtZTogXCJCZXppZXJcIlxuICAgICAgc2NhbGU6IDEuMFxuICAgICAgY2hhcl9tYXRyaXg6IFtcbiAgICAgICAgWyAgMSwgIDAsICAwLCAgMCBdLFxuICAgICAgICBbIC0zLCAgMywgIDAsICAwIF0sXG4gICAgICAgIFsgIDMsIC02LCAgMywgIDAgXSxcbiAgICAgICAgWyAtMSwgIDMsIC0zLCAgMSBdXG4gICAgICBdXG4gICAgICBjb2xvcjogJyNENUE5RUYnXG5cbiAgICBoZXJtaXRlOlxuICAgICAgbmFtZTogXCJIZXJtaXRlXCJcbiAgICAgIHNjYWxlOiAxLjBcbiAgICAgIGNoYXJfbWF0cml4OiBbXG4gICAgICAgIFsgIDEsICAwLCAgMCwgIDAgXSxcbiAgICAgICAgWyAgMCwgIDAsICAxLCAgMCBdLFxuICAgICAgICBbIC0zLCAgMywgLTIsIC0xIF0sXG4gICAgICAgIFsgIDIsIC0yLCAgMSwgIDEgXVxuICAgICAgXVxuICAgICAgY29sb3I6ICcjODNBMkQ2J1xuXG4gICAgY2F0bXVsbHJvbTpcbiAgICAgIG5hbWU6IFwiQ2F0bXVsbC1Sb21cIlxuICAgICAgc2NhbGU6ICgxLjAvMi4wKVxuICAgICAgY2hhcl9tYXRyaXg6IFtcbiAgICAgICAgWyAgMCwgIDIsICAwLCAgMCBdLFxuICAgICAgICBbIC0xLCAgMCwgIDEsICAwIF0sXG4gICAgICAgIFsgIDIsIC01LCAgNCwgLTEgXSxcbiAgICAgICAgWyAtMSwgIDMsIC0zLCAgMSBdXG4gICAgICBdXG4gICAgICBjb2xvcjogJyM5NEQ2ODMnXG5cbiAgICBic3BsaW5lOlxuICAgICAgbmFtZTogXCJCLVNwbGluZVwiXG4gICAgICBzY2FsZTogKDEuMC82LjApXG4gICAgICBjaGFyX21hdHJpeDogW1xuICAgICAgICBbICAxLCAgNCwgIDEsICAwIF0sXG4gICAgICAgIFsgLTMsICAwLCAgMywgIDAgXSxcbiAgICAgICAgWyAgMywgLTYsICAzLCAgMCBdLFxuICAgICAgICBbIC0xLCAgMywgLTMsICAxIF1cbiAgICAgIF1cbiAgICAgIGNvbG9yOiAnI0UzQTQ0NSdcblxuICBjb25zdHJ1Y3RvcjogLT5cbiAgICBAcmVuZGVyID1cbiAgICAgIHR5cGVfbmFtZTogbnVsbFxuICAgICAgbmFtZTogbnVsbFxuICAgICAgc2NhbGU6IG51bGxcbiAgICAgIGNoYXJfbWF0cml4OiBudWxsXG4gICAgICBjb2xvcjogbnVsbFxuXG4gICAgQHVzZV9tYXRyaXhfdHlwZShAY29uc3RydWN0b3IuZGVmYXVsdF9tYXRyaXgpXG4gICAgQHRfbWF0cml4ID0gbmV3IE1hdHJpeChbWzAsMCwwLDBdXSlcbiAgICBzdXBlclxuXG4gIHVzZV9tYXRyaXhfdHlwZTogKHR5cGVfbmFtZSkgLT5cbiAgICBAcmVuZGVyLnR5cGVfbmFtZSA9IEB0eXBlX25hbWVcbiAgICBAcmVuZGVyLm5hbWUgPSBAY29uc3RydWN0b3IudHlwZVt0eXBlX25hbWVdLm5hbWVcbiAgICBAcmVuZGVyLnNjYWxlID0gQGNvbnN0cnVjdG9yLnR5cGVbdHlwZV9uYW1lXS5zY2FsZVxuICAgIEByZW5kZXIuY2hhcl9tYXRyaXggPSBuZXcgTWF0cml4KEBjb25zdHJ1Y3Rvci50eXBlW3R5cGVfbmFtZV0uY2hhcl9tYXRyaXgpXG4gICAgQHJlbmRlci5jb2xvciA9IEBjb25zdHJ1Y3Rvci50eXBlW3R5cGVfbmFtZV0uY29sb3JcblxuICBmaW5kX3BlbjogLT5cbiAgICBwID0gQHBvaW50c1swXVxuICAgIGlmIHA/LmVuYWJsZWRcbiAgICAgIHBcbiAgICBlbHNlXG4gICAgICBBUFAuZGVidWcoXCJtaXNzaW5nIHBlblwiKSB1bmxlc3MgcFxuICAgICAgbnVsbFxuXG4gIG5ld19zZWdtZW50OiAtPlxuICAgIG5ldyBNYXRyaXhTcGxpbmVTZWdtZW50KHRoaXMpXG5cbiAgZWFjaF9wb2ludDogKGluY2x1ZGVfZmlyc3QgPSB0cnVlKSAtPlxuICAgIHJldHVybiB1bmxlc3MgQHNlZ21lbnQ/XG4gICAgZmlyc3QgPSB0cnVlXG4gICAgZm9yIHMgaW4gQHNlZ21lbnRcbiAgICAgIGZvciBwIGZyb20gcy5lYWNoX3BvaW50KGZpcnN0KVxuICAgICAgICBpZiBmaXJzdFxuICAgICAgICAgIGZpcnN0ID0gZmFsc2VcbiAgICAgICAgICB5aWVsZCBwIGlmIGluY2x1ZGVfZmlyc3RcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHlpZWxkIHBcbiAgICByZXR1cm5cblxuICBmaW5kX3BvaW50OiAoeCwgeSkgLT5cbiAgICBmb3IgcCBmcm9tIEBlYWNoX3BvaW50KClcbiAgICAgIGlmIHA/LmNvbnRhaW5zKHgsIHkpXG4gICAgICAgIHJldHVybiBwXG4gICAgcmV0dXJuIG51bGxcblxuICBzZXRfdF9tYXRyaXg6ICh0KSAtPlxuICAgIEB0X21hdHJpeC5zZXQoMCwgMCwgMSlcbiAgICBAdF9tYXRyaXguc2V0KDAsIDEsIHQpXG4gICAgQHRfbWF0cml4LnNldCgwLCAyLCB0ICogdClcbiAgICBAdF9tYXRyaXguc2V0KDAsIDMsIHQgKiB0ICogdClcblxuICBldmFsX3NlZ21lbnRfYXQ6ICh0X3NlZ21lbnQsIHQpIC0+XG4gICAgQHNldF90X21hdHJpeCh0KVxuXG4gICAgbSA9IEB0X21hdHJpeC5tdWx0aXBseShAcmVuZGVyLmNoYXJfbWF0cml4KVxuICAgIHAgPSBAc2VnbWVudFt0X3NlZ21lbnRdLnBvaW50c1xuXG4gICAgdG90YWxfeCA9IDAuMFxuICAgIHRvdGFsX3kgPSAwLjBcblxuICAgIGZvciBpIGluIFswLi4zXVxuICAgICAgdmFsdWUgPSBtLmdldCgwLCBpKVxuICAgICAgdG90YWxfeCArPSB2YWx1ZSAqIHBbaV0ueFxuICAgICAgdG90YWxfeSArPSB2YWx1ZSAqIHBbaV0ueVxuXG4gICAgcmV0dXJuXG4gICAgICB4OiB0b3RhbF94ICogQHJlbmRlci5zY2FsZVxuICAgICAgeTogdG90YWxfeSAqIEByZW5kZXIuc2NhbGVcblxuICBldmFsX2N1cnJlbnRfc2VnbWVudF9hdDogKHQpIC0+XG4gICAgQGV2YWxfc2VnbWVudF9hdChAY3VycmVudF9zZWdtZW50LCB0KVxuXG4gIHNlcGFyYXRlX3Q6ICh0ID0gQVBQLnRfcmVhbCkgLT5cbiAgICB0X3NlZ21lbnQgPSBNYXRoLmZsb29yKHQpXG4gICAgdF9mcmFjdCA9IHQgLSB0X3NlZ21lbnRcbiAgICBpZiB0ID49IEBlbmFibGVkX3NlZ21lbnRzXG4gICAgICB0X3NlZ21lbnQgPSBAZW5hYmxlZF9zZWdtZW50cyAtIDFcbiAgICAgIHRfZnJhY3QgPSAxLjBcbiAgICByZXR1cm4gW3Rfc2VnbWVudCwgdF9mcmFjdF1cblxuICBjdXJyZW50X3NlZ21lbnQ6IC0+XG4gICAgW3Rfc2VnbWVudCwgdF9mcmFjdF0gPSBAc2VwYXJhdGVfdChBUFAudF9yZWFsKVxuICAgIEBzZWdtZW50W3Rfc2VnbWVudF1cblxuICBldmFsX2F0OiAodCkgLT5cbiAgICBbdF9zZWdtZW50LCB0X2ZyYWN0XSA9IEBzZXBhcmF0ZV90KHQpXG4gICAgQGV2YWxfc2VnbWVudF9hdCh0X3NlZ21lbnQsIHRfZnJhY3QpXG5cbiAgZXZhbF9jdXJyZW50OiAtPlxuICAgIEBldmFsX2F0KEFQUC50X3JlYWwpXG5cbiAgdXBkYXRlX2F0OiAodCkgPT5cbiAgICBmb3IgcyBpbiBAc2VnbWVudFxuICAgICAgcy51cGRhdGUodClcblxuICB1cGRhdGU6IC0+XG4gICAgQHVwZGF0ZV9hdChBUFAudClcblxuICBkcmF3OiAtPlxuICAgIGZvciBzIGluIEBzZWdtZW50XG4gICAgICBzLmRyYXcoKVxuXG4gIGRyYXdfY3VydmU6IChvdmVycmlkZV9jb2xvciA9IG51bGwpIC0+XG4gICAgcmV0dXJuIHVubGVzcyBAcG9pbnRzP1xuXG4gICAgI3AgPSBAZmluZF9wZW4oKVxuXG4gICAgY3R4ID0gQVBQLmdyYXBoX2N0eFxuICAgIGN0eC5iZWdpblBhdGgoKVxuICAgIGN0eC5zdHJva2VTdHlsZSA9IEByZW5kZXIuY29sb3JcbiAgICBjdHgubGluZVdpZHRoID0gM1xuXG4gICAgdCA9IDAuMFxuICAgIG1heF90ID0gQHNlZ21lbnRfY291bnQgKyAxXG4gICAgcG9zaXRpb24gPSBAZXZhbF9hdCh0KVxuICAgIGN0eC5tb3ZlVG8ocG9zaXRpb24ueCwgcG9zaXRpb24ueSlcbiAgICB3aGlsZSB0IDwgbWF4X3RcbiAgICAgIHQgKz0gMC4wMlxuICAgICAgcG9zaXRpb24gPSBAZXZhbF9hdCh0KVxuICAgICAgY3R4LmxpbmVUbyhwb3NpdGlvbi54LCBwb3NpdGlvbi55KVxuXG4gICAgY3R4LnN0cm9rZSgpXG5cbiAgZ2V0X25vcm1hbDogKHQgPSBBUFAudCkgLT5cbiAgICBAY3VycmVudF9zZWdtZW50KCkuZ2V0X25vcm1hbCh0KVxuXG4gIGRyYXdfdGlja3M6IC0+XG5cbiAgZHJhd19wZW46IC0+XG4gICAgbm9ybWFsID0gQGdldF9ub3JtYWwoKVxuICAgIGlmIG5vcm1hbD9cbiAgICAgIHBlbl9wb3NpdGlvbiA9IEBldmFsX2N1cnJlbnQoKVxuICAgICAgYXJyb3cgICAgICAgPSBWZWMyLnNjYWxlKG5vcm1hbCwgMjIuMClcbiAgICAgIGFycm93dGlwICAgID0gVmVjMi5zY2FsZShub3JtYWwsIDE1LjApXG4gICAgICBhcnJvd19zaGFmdCA9IFZlYzIuc2NhbGUobm9ybWFsLCA2NS4wKVxuXG4gICAgICBhbmdsZSA9IFRBVSAvIDguMFxuICAgICAgYXJyb3dfc2lkZTEgPSBWZWMyLnJvdGF0ZShhcnJvdywgYW5nbGUpXG4gICAgICBhcnJvd19zaWRlMiA9IFZlYzIucm90YXRlKGFycm93LCAtYW5nbGUpXG5cbiAgICAgIGFycm93dGlwLnggKz0gcGVuX3Bvc2l0aW9uLnhcbiAgICAgIGFycm93dGlwLnkgKz0gcGVuX3Bvc2l0aW9uLnlcblxuICAgICAgY3R4ID0gQVBQLmdyYXBoX2N0eFxuICAgICAgY3R4LmJlZ2luUGF0aCgpXG4gICAgICBjdHgubW92ZVRvKGFycm93dGlwLngsIGFycm93dGlwLnkpXG4gICAgICBjdHgubGluZVRvKGFycm93dGlwLnggKyBhcnJvd19zaGFmdC54LCBhcnJvd3RpcC55ICsgYXJyb3dfc2hhZnQueSlcbiAgICAgIGN0eC5tb3ZlVG8oYXJyb3d0aXAueCwgYXJyb3d0aXAueSlcbiAgICAgIGN0eC5saW5lVG8oYXJyb3d0aXAueCArIGFycm93X3NpZGUxLngsIGFycm93dGlwLnkgKyBhcnJvd19zaWRlMS55KVxuICAgICAgY3R4Lm1vdmVUbyhhcnJvd3RpcC54LCBhcnJvd3RpcC55KVxuICAgICAgY3R4LmxpbmVUbyhhcnJvd3RpcC54ICsgYXJyb3dfc2lkZTIueCwgYXJyb3d0aXAueSArIGFycm93X3NpZGUyLnkpXG4gICAgICBjdHguc3Ryb2tlU3R5bGUgPSAnIzAwMDAwMCdcbiAgICAgIGN0eC5saW5lV2lkdGggPSAyXG4gICAgICBjdHgubGluZUNhcCA9IFwicm91bmRcIlxuICAgICAgY3R4LnN0cm9rZSgpXG5cbiAgICAgIHBsYWJlbF9vZmZzZXQgPSBWZWMyLnNjYWxlKFZlYzIubm9ybWFsaXplKGFycm93X3NoYWZ0KSwgQHBlbl9sYWJlbF9vZmZzZXRfbGVuZ3RoICsgMylcbiAgICAgIHBseCA9IGFycm93dGlwLnggKyBhcnJvd19zaGFmdC54ICsgcGxhYmVsX29mZnNldC54IC0gQHBlbl9sYWJlbF9vZmZzZXQueFxuICAgICAgcGx5ID0gYXJyb3d0aXAueSArIGFycm93X3NoYWZ0LnkgKyBwbGFiZWxfb2Zmc2V0LnkgLSBAcGVuX2xhYmVsX29mZnNldC55ICsgQHBlbl9sYWJlbF9oZWlnaHRcbiAgICAgIGN0eC5maWxsU3R5bGUgPSAnIzAwMCdcbiAgICAgIGN0eC5maWxsVGV4dChAcGVuX2xhYmVsLCBwbHgsIHBseSk7XG53aW5kb3cuQVBQID0gbnVsbFxuXG5UQVUgPSAyICogTWF0aC5QSVxuXG5jbGFzcyBMRVJQaW5nU3BsaW5lc1xuICBAY3JlYXRlX3BvaW50X21hcmdpbjogMC4xMlxuXG4gIEBwb2ludF9yYWRpdXM6IDVcbiAgQHBvaW50X21vdmVfbWFyZ2luOiAyNFxuICBAcG9pbnRfbGFiZWxfZmxpcF9tYXJnaW46IDMyXG5cbiAgQHBvaW50X2xhYmVsczogXCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWlwiXG4gIEBwb2ludF9sYWJlbF9oZWlnaHQ6IDIyXG5cbiAgQHBlbl9sYWJlbF9oZWlnaHQ6IDIyXG5cbiAgQG1vdXNlb3Zlcl9wb2ludF9yYWRpdXNfYm9vc3Q6IDZcblxuICBAc3RvcmFnZV9wcmVmaXggPSAnbGVycF9zcGxpbmUnXG5cbiAgY29uc3RydWN0b3I6IChAY29udGV4dCkgLT5cblxuICBpbml0OiAoKSAtPlxuICAgIGNvbnNvbGUubG9nKCdTdGFydGluZyBpbml0KCkuLi4nKVxuXG4gICAgQHJ1bm5pbmcgPSBmYWxzZVxuXG4gICAgQGNvbnRlbnRfZWwgPSBAY29udGV4dC5nZXRFbGVtZW50QnlJZCgnY29udGVudCcpXG5cbiAgICBAc2hvd190b29sdGlwcyA9IEBjb250ZXh0LmdldEVsZW1lbnRCeUlkKCdzaG93X3Rvb2x0aXBzJylcbiAgICBAc2hvd190b29sdGlwcy5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBAb25fc2hvd190b29sdGlwc19jaGFuZ2UpXG4gICAgQHNob3dfdG9vbHRpcHMuY2hlY2tlZCA9IHRydWUgICAgXG5cbiAgICBAb3B0aW9uID1cbiAgICAgIGNvbm5lY3RfY3ViaWNfY29udHJvbF9wb2ludHM6ICAgIG5ldyBVSS5Cb29sT3B0aW9uKCdjb25uZWN0X2N1YmljX2NvbnRyb2xfcG9pbnRzJywgdHJ1ZSlcbiAgICAgIHNob3dfdGlja3M6ICAgICAgICAgICAgICAgICAgICAgIG5ldyBVSS5Cb29sT3B0aW9uKCdzaG93X3RpY2tzJywgZmFsc2UpXG4gICAgICBzaG93X3Blbl9sYWJlbDogICAgICAgICAgICAgICAgICBuZXcgVUkuQm9vbE9wdGlvbignc2hvd19wZW5fbGFiZWwnLCB0cnVlKVxuICAgICAgc2hvd19hbGdvcml0aG06ICAgICAgICAgICAgICAgICAgbmV3IFVJLkJvb2xPcHRpb24oJ3Nob3dfYWxnb3JpdGhtJywgdHJ1ZSlcbiAgICAgIGFsdF9hbGdvcml0aG1fbmFtZXM6ICAgICAgICAgICAgIG5ldyBVSS5Cb29sT3B0aW9uKCdhbHRfYWxnb3JpdGhtX25hbWVzJywgdHJ1ZSlcbiAgICAgIHJlYmFsYW5jZV9wb2ludHNfb25fb3JkZXJfdXA6ICAgIG5ldyBVSS5Cb29sT3B0aW9uKCdyZWJhbGFuY2VfcG9pbnRzX29uX29yZGVyX3VwJywgZmFsc2UpXG4gICAgICByZWJhbGFuY2VfcG9pbnRzX29uX29yZGVyX2Rvd246ICBuZXcgVUkuQm9vbE9wdGlvbigncmViYWxhbmNlX3BvaW50c19vbl9vcmRlcl9kb3duJywgZmFsc2UpXG4gICAgICBzaG93X3Rvb2x0aXBzOiAgICAgICAgICAgICAgICAgICBuZXcgVUkuQm9vbE9wdGlvbignc2hvd190b29sdGlwcycsIHRydWUpXG4gICAgICBtb2RlOiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgVUkuQ2hvaWNlT3B0aW9uKCdtb2RlX2Nob2ljZScsICdiZXppZXInKVxuXG4gICAgQG9wdGlvbi5zaG93X3RpY2tzLnJlZ2lzdGVyX2NhbGxiYWNrXG4gICAgICBvbl9jaGFuZ2U6IEBvbl9zaG93X3RpY2tzX2NoYW5nZVxuIFxuICAgIEBvcHRpb24uc2hvd19wZW5fbGFiZWwucmVnaXN0ZXJfY2FsbGJhY2tcbiAgICAgIG9uX2NoYW5nZTogQG9uX3Blbl9sYWJlbF9jaGFuZ2VcblxuICAgIEBvcHRpb24uYWx0X2FsZ29yaXRobV9uYW1lcy5yZWdpc3Rlcl9jYWxsYmFja1xuICAgICAgb25fY2hhbmdlOiBAb25fYWx0X2FsZ29yaXRobV9uYW1lc19jaGFuZ2VcblxuICAgIEBvcHRpb24uc2hvd19hbGdvcml0aG0ucmVnaXN0ZXJfY2FsbGJhY2tcbiAgICAgIG9uX3RydWU6ICBAb25fc2hvd19hbGdvcml0aG1fdHJ1ZVxuICAgICAgb25fZmFsc2U6IEBvbl9zaG93X2FsZ29yaXRobV9mYWxzZVxuXG4gICAgQG9wdGlvbi5tb2RlLnJlZ2lzdGVyX2NhbGxiYWNrXG4gICAgICBvbl9jaGFuZ2U6IEBvbl9tb2RlX2NoYW5nZVxuXG4gICAgQGJlemllcl9tb2RlID0gZmFsc2VcbiAgICBAc3BsaW5lX21vZGUgPSBmYWxzZVxuXG4gICAgQGdyYXBoX3dyYXBwZXIgICA9IEBmaW5kX2VsZW1lbnQoJ2dyYXBoX3dyYXBwZXInKVxuICAgIEBncmFwaF9jYW52YXMgICAgPSBAZmluZF9lbGVtZW50KCdncmFwaCcpXG4gICAgI0BncmFwaF91aV9jYW52YXMgPSBAY29udGV4dC5nZXRFbGVtZW50QnlJZCgnZ3JhcGhfdWknKVxuXG4gICAgQGdyYXBoX2N0eCAgICA9IEBncmFwaF9jYW52YXMuZ2V0Q29udGV4dCgnMmQnLCBhbHBoYTogdHJ1ZSlcbiAgICAjZ3JhcGhfdWlfY3R4ID0gQGdyYXBoX3VpX2NhbnZhcy5nZXRDb250ZXh0KCcyZCcsIGFscGhhOiB0cnVlKVxuXG4gICAgQGdyYXBoX2N0eC5mb250ID0gXCJib2xkICN7TEVSUGluZ1NwbGluZXMucG9pbnRfbGFiZWxfaGVpZ2h0fXB4IHNhbnMtc2VyaWZcIlxuXG4gICAgQGdyYXBoX3dpZHRoICA9IEBncmFwaF9jYW52YXMud2lkdGhcbiAgICBAZ3JhcGhfaGVpZ2h0ID0gQGdyYXBoX2NhbnZhcy5oZWlnaHRcblxuICAgIEBwb2ludF9tb3ZlX21hcmdpbiA9XG4gICAgICBtaW5feDogTEVSUGluZ1NwbGluZXMucG9pbnRfbW92ZV9tYXJnaW5cbiAgICAgIG1pbl95OiBMRVJQaW5nU3BsaW5lcy5wb2ludF9tb3ZlX21hcmdpblxuICAgICAgbWF4X3g6IEBncmFwaF93aWR0aCAgLSBMRVJQaW5nU3BsaW5lcy5wb2ludF9tb3ZlX21hcmdpblxuICAgICAgbWF4X3k6IEBncmFwaF9oZWlnaHQgLSBMRVJQaW5nU3BsaW5lcy5wb2ludF9tb3ZlX21hcmdpblxuXG4gICAgQHBvaW50X2xhYmVsX2ZsaXBfbWFyZ2luID1cbiAgICAgIG1pbl94OiBMRVJQaW5nU3BsaW5lcy5wb2ludF9sYWJlbF9mbGlwX21hcmdpblxuICAgICAgbWluX3k6IExFUlBpbmdTcGxpbmVzLnBvaW50X2xhYmVsX2ZsaXBfbWFyZ2luXG4gICAgICBtYXhfeDogQGdyYXBoX3dpZHRoICAtIExFUlBpbmdTcGxpbmVzLnBvaW50X2xhYmVsX2ZsaXBfbWFyZ2luXG4gICAgICBtYXhfeTogQGdyYXBoX2hlaWdodCAtIExFUlBpbmdTcGxpbmVzLnBvaW50X2xhYmVsX2ZsaXBfbWFyZ2luXG5cbiAgICBAdHZhciA9IEBjb250ZXh0LmdldEVsZW1lbnRCeUlkKCd0dmFyJylcblxuICAgIEB0c2xpZGVyX2J0bl9taW4gPSBAZmluZF9lbGVtZW50KCd0Ym94X3NsaWRlcl9idG5fbWluJylcbiAgICBAdHNsaWRlcl9idG5fbWluLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgQG9uX3RzbGlkZV9idG5fbWluX2NsaWNrKVxuXG4gICAgQHRzbGlkZXJfYnRuX21heCA9IEBmaW5kX2VsZW1lbnQoJ3Rib3hfc2xpZGVyX2J0bl9tYXgnKVxuICAgIEB0c2xpZGVyX2J0bl9tYXguYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBAb25fdHNsaWRlX2J0bl9tYXhfY2xpY2spXG5cbiAgICBAdHNsaWRlcl9iZyA9IEBmaW5kX2VsZW1lbnQoJ3Rib3hfc2xpZGVyJylcbiAgICBAdHNsaWRlcl9iZy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIEBvbl90c2xpZGVyX2JnX2NsaWNrKVxuXG4gICAgQHRzbGlkZXIgPVxuICAgICAgaGFuZGxlOiBAZmluZF9lbGVtZW50KCd0Ym94X3NsaWRlcl9oYW5kbGUnKVxuICAgICAgbWluOiAwXG4gICAgICBtYXg6IDI2NFxuICAgICAgZHJhZ19hY3RpdmU6IGZhbHNlXG4gICAgQHRzbGlkZXIucG9zaXRpb24gPSBAdHNsaWRlci5taW5cbiAgICBAdHNsaWRlci5yYW5nZSA9IEB0c2xpZGVyLm1heCAtIEB0c2xpZGVyLm1pblxuICAgIEB0c2xpZGVyLmhhbmRsZS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBAb25fdHNsaWRlcl9tb3VzZWRvd24pXG5cbiAgICBAYnRuX3BsYXlfcGF1c2UgPSBAZmluZF9lbGVtZW50KCdidXR0b25fcGxheV9wYXVzZScpXG4gICAgQGJ0bl9wbGF5X3BhdXNlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJyxAb25fYnRuX3BsYXlfcGF1c2VfY2xpY2spXG5cbiAgICBAbnVtX3BvaW50cyA9IEBmaW5kX2VsZW1lbnQoJ251bV9wb2ludHMnKVxuIFxuICAgIEBwb2ludHNfd3JhcHBlciA9IEBmaW5kX2VsZW1lbnQoJ3BvaW50c193cmFwcGVyJylcblxuICAgIEBhZGRfcG9pbnRfYnRuID0gQGZpbmRfZWxlbWVudCgnYWRkX3BvaW50JylcbiAgICBAYWRkX3BvaW50X2J0bj8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBAb25fYWRkX3BvaW50X2J0bl9jbGljaylcblxuICAgIEByZW1vdmVfcG9pbnRfYnRuID0gQGZpbmRfZWxlbWVudCgncmVtb3ZlX3BvaW50JylcbiAgICBAcmVtb3ZlX3BvaW50X2J0bj8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBAb25fcmVtb3ZlX3BvaW50X2J0bl9jbGljaylcblxuICAgIEBudW1fb3JkZXIgPSBAZmluZF9lbGVtZW50KCdudW1fb3JkZXInKVxuXG4gICAgQG9yZGVyX3dyYXBwZXIgPSBAZmluZF9lbGVtZW50KCdvcmRlcl93cmFwcGVyJylcblxuICAgIEBhZGRfb3JkZXJfYnRuID0gQGZpbmRfZWxlbWVudCgnYWRkX29yZGVyJylcbiAgICBAYWRkX29yZGVyX2J0bj8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBAb25fYWRkX29yZGVyX2J0bl9jbGljaylcblxuICAgIEBzdWJfb3JkZXJfYnRuID0gQGZpbmRfZWxlbWVudCgnc3ViX29yZGVyJylcbiAgICBAc3ViX29yZGVyX2J0bj8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBAb25fc3ViX29yZGVyX2J0bl9jbGljaylcblxuICAgIEBudW1fc2VnbWVudHMgPSBAZmluZF9lbGVtZW50KCdudW1fc2VnbWVudHMnKVxuXG4gICAgQHNlZ21lbnRfd3JhcHBlciA9IEBmaW5kX2VsZW1lbnQoJ3NlZ21lbnRfd3JhcHBlcicpXG5cbiAgICBAYWRkX3NlZ21lbnRfYnRuID0gQGZpbmRfZWxlbWVudCgnYWRkX3NlZ21lbnQnKVxuICAgIEBhZGRfc2VnbWVudF9idG4/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgQG9uX2FkZF9zZWdtZW50X2J0bl9jbGljaylcblxuICAgIEBzdWJfc2VnbWVudF9idG4gPSBAZmluZF9lbGVtZW50KCdzdWJfc2VnbWVudCcpXG4gICAgQHN1Yl9zZWdtZW50X2J0bj8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBAb25fc3ViX3NlZ21lbnRfYnRuX2NsaWNrKVxuXG4gICAgQGFsZ29yaXRobWJveCAgID0gQGZpbmRfZWxlbWVudCgnYWxnb3JpdGhtYm94JylcbiAgICBAYWxnb3JpdGhtX3RleHQgPSBAZmluZF9lbGVtZW50KCdhbGdvcml0aG1fdGV4dCcpXG5cbiAgICBAYmV6aWVyX2N1cnZlID0gbmV3IEJlemllcigpXG4gICAgQGJ1aWxkX2JlemllcigpXG5cbiAgICBAc3BsaW5lX29yZGVyID0gM1xuICAgIEBzcGxpbmVfc2VnbWVudHMgPSAzXG4gICAgQHNwbGluZV9jdXJ2ZSA9IG5ldyBTcGxpbmUoKVxuICAgIEBidWlsZF9zcGxpbmUoKVxuXG4gICAgQG1hdHJpeF9zcGxpbmVfY3VydmUgPSBuZXcgTWF0cml4U3BsaW5lKClcbiAgICBAYnVpbGRfbWF0cml4X3NwbGluZSgpXG5cbiAgICBAcmVzZXRfbG9vcCgpXG5cbiAgICBAb3B0aW9uLm1vZGUuY2hhbmdlKClcblxuICAgIEBzaGlmdCA9IGZhbHNlXG5cbiAgICBAY29udGV4dC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgICBAb25fa2V5ZG93bilcbiAgICBAY29udGV4dC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsICAgICBAb25fa2V5dXApXG4gICAgQGNvbnRleHQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgQG9uX21vdXNlbW92ZSlcbiAgICBAY29udGV4dC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBAb25fbW91c2Vkb3duKVxuICAgIEBjb250ZXh0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAgIEBvbl9tb3VzZXVwKVxuXG4gICAgY29uc29sZS5sb2coJ2luaXQoKSBjb21wbGV0ZWQhJylcblxuICAgIEB1cGRhdGUoKVxuICAgIEBzdG9wKClcblxuICAgICNAZGVidWcoXCJSZWFkeSFcIilcblxuICBkZWJ1ZzogKG1zZ190ZXh0KSAtPlxuICAgIGNvbnNvbGUubG9nKG1zZ190ZXh0KVxuICAgIHVubGVzcyBAZGVidWdib3g/XG4gICAgICBAZGVidWdib3ggPSBAY29udGV4dC5nZXRFbGVtZW50QnlJZCgnZGVidWdib3gnKVxuICAgICAgQGRlYnVnYm94LmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpXG5cbiAgICBoZHIgPSBAY3JlYXRlX2VsZW1lbnQoJ3NwYW4nLCBjbGFzczogWydoZHInXSlcbiAgICBtc2cgPSBAY3JlYXRlX2VsZW1lbnQoJ3NwYW4nLCBjbGFzczogWydtc2cnXSlcblxuICAgIHRpbWVzdGFtcCA9IG5ldyBEYXRlKClcbiAgICBoZHIudGV4dENvbnRlbnQgPSB0aW1lc3RhbXAudG9JU09TdHJpbmcoKVxuICAgIG1zZy50ZXh0Q29udGVudCA9ICcnICsgbXNnX3RleHRcblxuICAgIGxpbmUgPSBAY3JlYXRlX2VsZW1lbnQoJ2RpdicsIGNsYXNzOiBbJ2RiZ19saW5lJ10pXG4gICAgbGluZS5hcHBlbmRDaGlsZChoZHIpXG4gICAgbGluZS5hcHBlbmRDaGlsZChtc2cpXG4gICAgQGRlYnVnYm94LmFwcGVuZENoaWxkKGxpbmUpXG5cbiAgICAjQGRlYnVnYm94LmFuaW1hdGUoeyBzY3JvbGxUb3A6IEBkZWJ1Z2JveC5wcm9wKFwic2Nyb2xsSGVpZ2h0XCIpfSwgNjAwKTtcbiAgICAjQGRlYnVnYm94LnNjcm9sbFRvcCA9IEBkZWJ1Z2JveC5zY3JvbGxIZWlnaHRcblxuICBmYXRhbF9lcnJvcjogKG1zZykgLT5cbiAgICBAcnVuaGluZyA9IGZhbHNlXG4gICAgbXNnID0gXCJGQVRBTCBFUlJPUjogI3ttc2d9XCJcbiAgICBAZGVidWcobXNnKVxuXG4gIGFzc2VydF9uZXZlcl9yZWFjaGVkOiAtPlxuICAgIEBmYXRhbF9lcnJvcihcImFzc2VydF9uZXZlcl9yZWFjaGVkKCkgd2FzIHJlYWNoZWRcIilcblxuICBjcmVhdGVfZWxlbWVudDogKHRhZ19uYW1lLCBvcHQgPSB7fSkgLT5cbiAgICBlbCA9IEBjb250ZXh0LmNyZWF0ZUVsZW1lbnQodGFnX25hbWUpXG4gICAgaWYgb3B0WydjbGFzcyddP1xuICAgICAgZm9yIGtsYXNzIGluIG9wdFsnY2xhc3MnXVxuICAgICAgICBlbC5jbGFzc0xpc3QuYWRkKGtsYXNzKVxuICAgIGVsXG5cbiAgZmluZF9lbGVtZW50OiAoaWQpIC0+XG4gICAgZWwgPSBAY29udGV4dC5nZXRFbGVtZW50QnlJZChpZClcbiAgICBAZGVidWcoXCJFUlJPUjogbWlzc2luZyBlbGVtZW50ICMje2lkfVwiKSB1bmxlc3MgZWw/XG4gICAgZWxcblxuICBzdG9yYWdlX2tleTogKGtleSkgLT5cbiAgICBcIiN7QGNvbnN0cnVjdG9yLnN0b3JhZ2VfcHJlZml4fS0je2tleX1cIlxuXG4gIHN0b3JhZ2Vfc2V0OiAoa2V5LCB2YWx1ZSwgZGVmYXVsdF92YWx1ZSA9IG51bGwpIC0+XG4gICAgaWYgZGVmYXVsdF92YWx1ZT8gYW5kIChkZWZhdWx0X3ZhbHVlIGlzIHZhbHVlKVxuICAgICAgQHN0b3JhZ2VfcmVtb3ZlKGtleSlcbiAgICBlbHNlXG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShAc3RvcmFnZV9rZXkoa2V5KSwgdmFsdWUpXG5cbiAgc3RvcmFnZV9nZXQ6IChrZXkpIC0+XG4gICAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oQHN0b3JhZ2Vfa2V5KGtleSkpXG5cbiAgc3RvcmFnZV9nZXRfaW50OiAoa2V5KSAtPlxuICAgIHBhcnNlSW50KEBzdG9yYWdlX2dldChrZXkpKVxuXG4gIHN0b3JhZ2VfZ2V0X2Zsb2F0OiAoa2V5KSAtPlxuICAgIHBhcnNlRmxvYXQoQHN0b3JhZ2VfZ2V0KGtleSkpXG5cbiAgc3RvcmFnZV9yZW1vdmU6IChrZXkpIC0+XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oQHN0b3JhZ2Vfa2V5KGtleSkpXG5cbiAgcmVzZXRfbG9vcDogLT5cbiAgICBAdCA9IDBcbiAgICBAdF9yZWFsID0gMFxuICAgIEB0X3N0ZXAgPSAwLjAwMlxuICAgIEBzZXRfdHNsaWRlcl9wb3NpdGlvbihAdHNsaWRlci5taW4sIGZhbHNlKVxuXG4gIGxvb3Bfc3RhcnQ6IC0+XG4gICAgQGxvb3BfcnVubmluZyA9IHRydWVcblxuICBsb29wX3N0b3A6IC0+XG4gICAgQGxvb3BfcnVubmluZyA9IGZhbHNlXG5cbiAgYnVpbGRfYmV6aWVyOiAtPlxuICAgIEBiZXppZXJfY3VydmUuYnVpbGQoKVxuXG4gIGJ1aWxkX3NwbGluZTogLT5cbiAgICBAc3BsaW5lX2N1cnZlLmJ1aWxkKEBzcGxpbmVfb3JkZXIsIEBzcGxpbmVfc2VnbWVudHMpXG4gICAgQHVwZGF0ZV9vcmRlcigpXG4gICAgQHVwZGF0ZV9zZWdtZW50cygpXG5cbiAgYnVpbGRfbWF0cml4X3NwbGluZTogLT5cbiAgICBAbWF0cml4X3NwbGluZV9jdXJ2ZS5idWlsZCgzLCBAc3BsaW5lX3NlZ21lbnRzKVxuICAgIEB1cGRhdGVfc2VnbWVudHMoKVxuXG4gIGNvbmZpZ3VyZV9mb3JfYmV6aWVyX21vZGU6IC0+XG4gICAgY29uc29sZS5sb2coXCJjb25maWd1cmUgZm9yIG1vZGU6IGJlemllclwiKVxuICAgIEBiZXppZXJfbW9kZSA9IHRydWVcbiAgICBAc3BsaW5lX21vZGUgPSBmYWxzZVxuICAgIEBtYXRyaXhfc3BsaW5lX21vZGUgPSBmYWxzZVxuICAgIEBjdXJ2ZSA9IEBiZXppZXJfY3VydmVcblxuICAgIEBvcmRlcl93cmFwcGVyLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpXG4gICAgQHNlZ21lbnRfd3JhcHBlci5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKVxuICAgIEBwb2ludHNfd3JhcHBlci5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKVxuXG4gICAgQHVwZGF0ZV9hbmRfZHJhdygpXG5cbiAgY29uZmlndXJlX2Zvcl9zcGxpbmVfbW9kZTogLT5cbiAgICBjb25zb2xlLmxvZyhcImNvbmZpZ3VyZSBmb3IgbW9kZTogc3BsaW5lXCIpXG4gICAgQGJlemllcl9tb2RlID0gZmFsc2VcbiAgICBAc3BsaW5lX21vZGUgPSB0cnVlXG4gICAgQG1hdHJpeF9zcGxpbmVfbW9kZSA9IGZhbHNlXG4gICAgQGN1cnZlID0gQHNwbGluZV9jdXJ2ZVxuXG4gICAgQG9yZGVyX3dyYXBwZXIuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJylcbiAgICBAc2VnbWVudF93cmFwcGVyLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpXG4gICAgQHBvaW50c193cmFwcGVyLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpXG5cbiAgICBAdXBkYXRlX2FuZF9kcmF3KClcblxuICBjb25maWd1cmVfZm9yX21hdHJpeF9zcGxpbmVfbW9kZTogLT5cbiAgICBjb25zb2xlLmxvZyhcImNvbmZpZ3VyZSBmb3IgbW9kZTogbWF0cml4IHNwbGluZVwiKVxuICAgIEBiZXppZXJfbW9kZSA9IGZhbHNlXG4gICAgQHNwbGluZV9tb2RlID0gZmFsc2VcbiAgICBAbWF0cml4X3NwbGluZV9tb2RlID0gdHJ1ZVxuICAgIEBjdXJ2ZSA9IEBtYXRyaXhfc3BsaW5lX2N1cnZlXG5cbiAgICBAb3JkZXJfd3JhcHBlci5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKVxuICAgIEBzZWdtZW50X3dyYXBwZXIuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJylcbiAgICBAcG9pbnRzX3dyYXBwZXIuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJylcblxuICAgIEB1cGRhdGVfYW5kX2RyYXcoKVxuXG4gIGNoYW5nZV9tb2RlOiAobW9kZSwgdXBkYXRlX29wdCA9IHRydWUpIC0+XG4gICAgQG9wdGlvbi5tb2RlLnNldChtb2RlKSBpZiB1cGRhdGVfb3B0XG5cbiAgICBzd2l0Y2ggbW9kZVxuICAgICAgd2hlbiAnYmV6aWVyJyB0aGVuIEBjb25maWd1cmVfZm9yX2Jlemllcl9tb2RlKClcbiAgICAgIHdoZW4gJ3NwbGluZScgdGhlbiBAY29uZmlndXJlX2Zvcl9zcGxpbmVfbW9kZSgpXG4gICAgICB3aGVuICdtYXRyaXhfc3BsaW5lJyB0aGVuIEBjb25maWd1cmVfZm9yX21hdHJpeF9zcGxpbmVfbW9kZSgpXG4gICAgICBlbHNlXG4gICAgICAgIEBmYXRhbF9lcnJvcihcImJhZCBtb2RlIG5hbWUgXFxcIiN7bW9kZX1cXFwiXCIpXG5cbiAgb25fbW9kZV9jaGFuZ2U6ID0+XG4gICAgQGNoYW5nZV9tb2RlKEBvcHRpb24ubW9kZS5nZXQoKSwgZmFsc2UpXG5cbiAgb25fc2hvd190b29sdGlwc19jaGFuZ2U6IChldmVudCkgPT5cbiAgICBpZiBAc2hvd190b29sdGlwcy5jaGVja2VkXG4gICAgICBAY29udGVudF9lbC5jbGFzc0xpc3QuYWRkKCdzaG93X3R0JylcbiAgICBlbHNlXG4gICAgICBAY29udGVudF9lbC5jbGFzc0xpc3QucmVtb3ZlKCdzaG93X3R0JylcblxuICBvbl9zaG93X3RpY2tzX2NoYW5nZTogPT5cbiAgICBAdXBkYXRlX2FuZF9kcmF3KClcblxuICBvbl9wZW5fbGFiZWxfY2hhbmdlOiA9PlxuICAgIEB1cGRhdGVfYW5kX2RyYXcoKVxuXG4gIG9uX2FsdF9hbGdvcml0aG1fbmFtZXNfY2hhbmdlOiA9PlxuICAgIEB1cGRhdGVfYWxnb3JpdGhtKClcblxuICBvbl9hZGRfcG9pbnRfYnRuX2NsaWNrOiAoZXZlbnQsIHVpKSA9PlxuICAgIEBjdXJ2ZS5lbmFibGVfcG9pbnQodHJ1ZSlcbiAgICBAdXBkYXRlX2FuZF9kcmF3KClcblxuICBvbl9yZW1vdmVfcG9pbnRfYnRuX2NsaWNrOiAoZXZlbnQsIHVpKSA9PlxuICAgIEBjdXJ2ZS5kaXNhYmxlX3BvaW50KClcbiAgICBAdXBkYXRlX2FuZF9kcmF3KClcblxuICB1cGRhdGVfb3JkZXI6IC0+XG4gICAgcmV0dXJuIHVubGVzcyBAc3BsaW5lX2N1cnZlXG5cbiAgICBpZiBAc3BsaW5lX29yZGVyIDwgQHNwbGluZV9jdXJ2ZS5tYXhfb3JkZXIoKVxuICAgICAgQGFkZF9vcmRlcl9idG4uZGlzYWJsZWQgPSBmYWxzZVxuICAgIGVsc2VcbiAgICAgIEBhZGRfb3JkZXJfYnRuLmRpc2FibGVkID0gdHJ1ZVxuXG4gICAgaWYgQHNwbGluZV9vcmRlciA+IEBzcGxpbmVfY3VydmUubWluX29yZGVyKClcbiAgICAgIEBzdWJfb3JkZXJfYnRuLmRpc2FibGVkID0gZmFsc2VcbiAgICBlbHNlXG4gICAgICBAc3ViX29yZGVyX2J0bi5kaXNhYmxlZCA9IHRydWVcblxuICAgIEBudW1fb3JkZXIudGV4dENvbnRlbnQgPSBcIiN7QHNwbGluZV9vcmRlcn1cIlxuXG4gIG9uX2FkZF9vcmRlcl9idG5fY2xpY2s6IChldmVudCwgdWkpID0+XG4gICAgaWYgQHNwbGluZV9vcmRlciA8IEBzcGxpbmVfY3VydmUubWF4X29yZGVyKClcbiAgICAgIEBzcGxpbmVfb3JkZXIgKz0gMVxuICAgICAgQGJ1aWxkX3NwbGluZSgpXG4gICAgQHVwZGF0ZV9hbmRfZHJhdygpXG5cbiAgb25fc3ViX29yZGVyX2J0bl9jbGljazogKGV2ZW50LCB1aSkgPT5cbiAgICBpZiBAc3BsaW5lX29yZGVyID4gQHNwbGluZV9jdXJ2ZS5taW5fb3JkZXIoKVxuICAgICAgQHNwbGluZV9vcmRlciAtPSAxXG4gICAgICBAYnVpbGRfc3BsaW5lKClcbiAgICBAdXBkYXRlX2FuZF9kcmF3KClcblxuICB1cGRhdGVfc2VnbWVudHM6IC0+XG4gICAgcmV0dXJuIHVubGVzcyBAc3BsaW5lX2N1cnZlXG5cbiAgICBpZiBAc3BsaW5lX3NlZ21lbnRzIDwgQHNwbGluZV9jdXJ2ZS5tYXhfc2VnbWVudHMoKVxuICAgICAgQGFkZF9zZWdtZW50X2J0bi5kaXNhYmxlZCA9IGZhbHNlXG4gICAgZWxzZVxuICAgICAgQGFkZF9zZWdtZW50X2J0bi5kaXNhYmxlZCA9IHRydWVcblxuICAgIGlmIEBzcGxpbmVfc2VnbWVudHMgPiBAc3BsaW5lX2N1cnZlLm1pbl9zZWdtZW50cygpXG4gICAgICBAc3ViX3NlZ21lbnRfYnRuLmRpc2FibGVkID0gZmFsc2VcbiAgICBlbHNlXG4gICAgICBAc3ViX3NlZ21lbnRfYnRuLmRpc2FibGVkID0gdHJ1ZVxuXG4gICAgQG51bV9zZWdtZW50cy50ZXh0Q29udGVudCA9IFwiI3tAc3BsaW5lX3NlZ21lbnRzIC0gMX1cIlxuXG4gIG9uX2FkZF9zZWdtZW50X2J0bl9jbGljazogKGV2ZW50LCB1aSkgPT5cbiAgICBpZiBAc3BsaW5lX3NlZ21lbnRzIDwgQHNwbGluZV9jdXJ2ZS5tYXhfc2VnbWVudHMoKVxuICAgICAgQHNwbGluZV9zZWdtZW50cyArPSAxXG4gICAgICBAYnVpbGRfc3BsaW5lKClcbiAgICBAdXBkYXRlX2FuZF9kcmF3KClcblxuICBvbl9zdWJfc2VnbWVudF9idG5fY2xpY2s6IChldmVudCwgdWkpID0+XG4gICAgaWYgQHNwbGluZV9zZWdtZW50cyA+IEBzcGxpbmVfY3VydmUubWluX3NlZ21lbnRzKClcbiAgICAgIEBzcGxpbmVfc2VnbWVudHMgLT0gMVxuICAgICAgQGJ1aWxkX3NwbGluZSgpXG4gICAgQHVwZGF0ZV9hbmRfZHJhdygpXG5cbiAgb25fYnRuX3BsYXlfcGF1c2VfY2xpY2s6IChldmVudCwgdWkpID0+XG4gICAgaWYgQHJ1bm5pbmdcbiAgICAgIEBzdG9wKClcbiAgICBlbHNlXG4gICAgICBAc3RhcnQoKVxuXG4gIHNldF90c2xpZGVyX3Bvc2l0aW9uOiAoeCwgdXBkYXRlX3QgPSB0cnVlKSAtPlxuICAgIHggPSBAdHNsaWRlci5taW4gaWYgeCA8IEB0c2xpZGVyLm1pblxuICAgIHggPSBAdHNsaWRlci5tYXggaWYgeCA+IEB0c2xpZGVyLm1heFxuXG4gICAgQHRzbGlkZXIucG9zaXRpb24gPSB4XG4gICAgQHRzbGlkZXIuaGFuZGxlLnN0eWxlLmxlZnQgPSBcIiN7eH1weFwiXG4gICAgQHNldF90X3BlcmMoICh4IC0gQHRzbGlkZXIubWluKSAvIEB0c2xpZGVyLnJhbmdlICkgaWYgdXBkYXRlX3RcblxuICBvbl90c2xpZGVyX2JnX2NsaWNrOiAoZXZlbnQpID0+XG4gICAgY2MgPSBAdHNsaWRlcl9iZy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICAgIGNvb3JkX3ggPSBldmVudC5wYWdlWCAtIGNjLmxlZnRcbiAgICBjb29yZF94IC09IHdpbmRvdy5zY3JvbGxYXG4gICAgdCA9IGNvb3JkX3ggLyBjYy53aWR0aFxuICAgIHNsaWRlcl9wb3MgPSBAdHNsaWRlci5taW4gKyAodCAqIChAdHNsaWRlci5tYXggLSBAdHNsaWRlci5taW4pKVxuICAgIEBzZXRfdHNsaWRlcl9wb3NpdGlvbihzbGlkZXJfcG9zKVxuICAgIEB1cGRhdGVfYW5kX2RyYXcoKVxuXG4gIG9uX3RzbGlkZV9idG5fbWluX2NsaWNrOiA9PlxuICAgIEBzZXRfdHNsaWRlcl9wb3NpdGlvbihAdHNsaWRlci5taW4pXG4gICAgQHVwZGF0ZV9hbmRfZHJhdygpXG5cbiAgb25fdHNsaWRlX2J0bl9tYXhfY2xpY2s6ID0+XG4gICAgQHNldF90c2xpZGVyX3Bvc2l0aW9uKEB0c2xpZGVyLm1heClcbiAgICBAdXBkYXRlX2FuZF9kcmF3KClcblxuICBzZXRfdDogKHZhbHVlKSAtPlxuICAgIEB0X3JlYWwgPSB2YWx1ZSBcbiAgICBtYXggPSBAY3VydmUudF9tYXgoKVxuICAgIEB0X3JlYWwgLT0gbWF4IHdoaWxlIEB0X3JlYWwgPiBtYXhcbiAgICBAdF9wZXJjID0gKEB0X3JlYWwgLSBAY3VydmUudF9taW4oKSkgLyBtYXhcblxuICAgIEB0ID0gQHRfcmVhbFxuICAgIGlmIEB0ID4gMFxuICAgICAgaWYgQHNwbGluZV9tb2RlXG4gICAgICAgIEBjdXJ2ZS5zZXRfdF9zZWdtZW50KE1hdGguZmxvb3IoQHRfcmVhbCkpXG4gICAgICAgIEB0ID0gQHRfcmVhbCAtIEBjdXJ2ZS50X3NlZ21lbnRcblxuICAgIEB0dmFyLnRleHRDb250ZW50ID0gKEB0X3JlYWwudG9GaXhlZCgyKSlcblxuICAgIGlmIEB0X3JlYWwgPT0gQGN1cnZlLnRfbWluKClcbiAgICAgIEB0c2xpZGVyX2J0bl9taW4uZGlzYWJsZWQgPSB0cnVlXG4gICAgZWxzZVxuICAgICAgQHRzbGlkZXJfYnRuX21pbi5kaXNhYmxlZCA9IGZhbHNlXG5cbiAgICBpZiBAdF9yZWFsID49IEBjdXJ2ZS50X21heCgpXG4gICAgICBAdCA9IDEuMFxuICAgICAgQHRzbGlkZXJfYnRuX21heC5kaXNhYmxlZCA9IHRydWVcbiAgICBlbHNlXG4gICAgICBAdHNsaWRlcl9idG5fbWF4LmRpc2FibGVkID0gZmFsc2VcblxuICBzZXRfdF9wZXJjOiAodmFsdWUpIC0+XG4gICAgbWluID0gQGN1cnZlLnRfbWluKClcbiAgICBAc2V0X3QoICh2YWx1ZSAqIChAY3VydmUudF9tYXgoKSAtIG1pbikpICsgbWluIClcblxuICBzdGFydDogPT5cbiAgICBpZiBAcnVubmluZ1xuICAgICAgIyBkbyBub3RoaW5nXG4gICAgZWxzZVxuICAgICAgQHJ1bm5pbmcgPSB0cnVlXG4gICAgICBAYnRuX3BsYXlfcGF1c2UuaW5uZXJIVE1MID0gXCImI3gyM0Y4O1wiXG4gICAgICBAc2NoZWR1bGVfZmlyc3RfZnJhbWUoKVxuXG4gIHN0b3A6ID0+XG4gICAgQHJ1bm5pbmcgPSBmYWxzZVxuICAgIEBidG5fcGxheV9wYXVzZS5pbm5lckhUTUwgPSBcIiYjeDIzRjU7XCJcblxuICB1cGRhdGVfYWxnb3JpdGhtOiAtPlxuICAgIHJldHVybiB1bmxlc3MgQGN1cnZlP1xuXG4gICAgaWYgQG9wdGlvbi5zaG93X2FsZ29yaXRobS52YWx1ZVxuICAgICAgQGFsZ29yaXRobV90ZXh0LmlubmVyVGV4dCA9IEBjdXJ2ZS5nZXRfYWxnb3JpdGhtX3RleHQoKVxuXG4gIG9uX3Nob3dfYWxnb3JpdGhtX3RydWU6ID0+XG4gICAgQGFsZ29yaXRobWJveC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKVxuICAgIEB1cGRhdGVfYWxnb3JpdGhtKClcblxuICBvbl9oaWRlX2FsZ29yaXRobV9mYWxzZTogPT5cbiAgICBAYWxnb3JpdGhtYm94LmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpXG5cbiAgY2xhbXBfdG9fY2FudmFzOiAodikgLT5cbiAgICB2LnggPSBAcG9pbnRfbW92ZV9tYXJnaW4ubWluX3ggaWYgdi54IDwgQHBvaW50X21vdmVfbWFyZ2luLm1pbl94XG4gICAgdi55ID0gQHBvaW50X21vdmVfbWFyZ2luLm1pbl95IGlmIHYueSA8IEBwb2ludF9tb3ZlX21hcmdpbi5taW5feVxuICAgIHYueCA9IEBwb2ludF9tb3ZlX21hcmdpbi5tYXhfeCBpZiB2LnggPiBAcG9pbnRfbW92ZV9tYXJnaW4ubWF4X3hcbiAgICB2LnkgPSBAcG9pbnRfbW92ZV9tYXJnaW4ubWF4X3kgaWYgdi55ID4gQHBvaW50X21vdmVfbWFyZ2luLm1heF95XG4gICAgdlxuXG4gIGdldF9tb3VzZV9jb29yZDogKGV2ZW50KSAtPlxuICAgIGNjID0gQGdyYXBoX2NhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICAgIGNvb3JkID1cbiAgICAgIHg6IGV2ZW50LnBhZ2VYIC0gY2MubGVmdFxuICAgICAgeTogZXZlbnQucGFnZVkgLSBjYy50b3BcblxuICAgIGNvb3JkLnggLT0gd2luZG93LnNjcm9sbFhcbiAgICBjb29yZC55IC09IHdpbmRvdy5zY3JvbGxZXG5cbiAgICBAY2xhbXBfdG9fY2FudmFzKGNvb3JkKVxuXG4gIG9uX21vdXNlbW92ZV90c2xpZGVyOiAoZXZlbnQpID0+XG4gICAgbW91c2UgPSBAZ2V0X21vdXNlX2Nvb3JkKGV2ZW50KVxuICAgIG9mZnNldCA9IG1vdXNlLnggLSBAdHNsaWRlci5kcmFnX3N0YXJ0XG4gICAgQHNldF90c2xpZGVyX3Bvc2l0aW9uKEB0c2xpZGVyLmRyYWdfc3RhcnRfcG9zaXRpb24gKyBvZmZzZXQpXG4gICAgQHVwZGF0ZV9hbmRfZHJhdygpXG5cbiAgb25fbW91c2Vtb3ZlX2NhbnZhczogKGV2ZW50KSA9PlxuICAgIG1vdXNlID0gQGdldF9tb3VzZV9jb29yZChldmVudClcbiAgICBmb3IgcCBmcm9tIEBjdXJ2ZS5lYWNoX3BvaW50KClcbiAgICAgIG9sZHggPSBwLnhcbiAgICAgIG9sZHkgPSBwLnlcbiAgICAgIGR4ID0gbW91c2UueCAtIG9sZHhcbiAgICAgIGR5ID0gbW91c2UueSAtIG9sZHlcbiAgICAgIGlmIHAuc2VsZWN0ZWRcbiAgICAgICAgaWYgKHAueCAhPSBtb3VzZS54KSBvciAocC55ICE9IG1vdXNlLnkpXG4gICAgICAgICAgQHBvaW50X2hhc19jaGFuZ2VkID0gdHJ1ZVxuXG4gICAgICAgIHAueCA9IG1vdXNlLnhcbiAgICAgICAgcC55ID0gbW91c2UueVxuXG4gICAgICAgIGlmIChAc3BsaW5lX21vZGUgb3IgQG1hdHJpeF9zcGxpbmVfbW9kZSkgYW5kIChAY3VydmUub3JkZXIgPT0gMykgYW5kIEFQUC5vcHRpb24uY29ubmVjdF9jdWJpY19jb250cm9sX3BvaW50cy5nZXQoKVxuICAgICAgICAgIGlmIHAua25vdFxuICAgICAgICAgICAgaWYgcC5wcmV2P1xuICAgICAgICAgICAgICBwLnByZXYueCArPSBkeFxuICAgICAgICAgICAgICBwLnByZXYueSArPSBkeVxuICAgICAgICAgICAgaWYgcC5uZXh0P1xuICAgICAgICAgICAgICBwLm5leHQueCArPSBkeFxuICAgICAgICAgICAgICBwLm5leHQueSArPSBkeVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHVubGVzcyBAc2hpZnRcbiAgICAgICAgICAgICAgaWYgcC5wcmV2PyBhbmQgcC5wcmV2LnByZXY/IGFuZCBwLnByZXYua25vdFxuICAgICAgICAgICAgICAgIHAucHJldi5wcmV2Lm1pcnJvcl9hcm91bmRfbmV4dF9rbm90KClcbiAgICAgICAgICAgICAgZWxzZSBpZiBwLm5leHQ/IGFuZCBwLm5leHQubmV4dD8gYW5kIHAubmV4dC5rbm90XG4gICAgICAgICAgICAgICAgcC5uZXh0Lm5leHQubWlycm9yX2Fyb3VuZF9wcmV2X2tub3QoKVxuXG4gICAgICBvbGRob3ZlciA9IHAuaG92ZXJcbiAgICAgIGlmIHAuY29udGFpbnMobW91c2UueCwgbW91c2UueSlcbiAgICAgICAgcC5ob3ZlciA9IHRydWVcbiAgICAgIGVsc2VcbiAgICAgICAgcC5ob3ZlciA9IGZhbHNlXG5cbiAgICAgIGlmIChwLmhvdmVyICE9IG9sZGhvdmVyKSBvciAocC54ICE9IG9sZHgpIG9yIChwLnkgIT0gb2xkeSlcbiAgICAgICAgQHVwZGF0ZV9hbmRfZHJhdygpXG5cbiAgb25fbW91c2Vtb3ZlOiAoZXZlbnQpID0+XG4gICAgaWYgQHRzbGlkZXIuZHJhZ19hY3RpdmVcbiAgICAgIEBvbl9tb3VzZW1vdmVfdHNsaWRlcihldmVudClcbiAgICBlbHNlXG4gICAgICBAb25fbW91c2Vtb3ZlX2NhbnZhcyhldmVudClcblxuICBvbl90c2xpZGVyX21vdXNlZG93bjogKGV2ZW50KSA9PlxuICAgIEB0c2xpZGVyLmRyYWdfYWN0aXZlID0gdHJ1ZVxuICAgIG1vdXNlID0gQGdldF9tb3VzZV9jb29yZChldmVudClcbiAgICBAdHNsaWRlci5kcmFnX3N0YXJ0ID0gbW91c2UueFxuICAgIEB0c2xpZGVyLmRyYWdfc3RhcnRfcG9zaXRpb24gPSBAdHNsaWRlci5wb3NpdGlvblxuICAgIEB0c2xpZGVyLmhhbmRsZS5jbGFzc0xpc3QuYWRkKCdkcmFnJylcbiAgICBAc3RvcCgpIGlmIEBydW5uaW5nXG5cbiAgb25fbW91c2Vkb3duOiAoZXZlbnQpID0+XG4gICAgQHBvaW50X2hhc19jaGFuZ2VkID0gZmFsc2VcbiAgICBtb3VzZSA9IEBnZXRfbW91c2VfY29vcmQoZXZlbnQpXG4gICAgcCA9IEBjdXJ2ZS5maW5kX3BvaW50KG1vdXNlLngsIG1vdXNlLnkpXG4gICAgaWYgcD9cbiAgICAgIHAuc2VsZWN0ZWQgPSB0cnVlXG5cbiAgb25fbW91c2V1cF90c2xpZGVyOiAoZXZlbnQpID0+XG4gICAgQHRzbGlkZXIuZHJhZ19hY3RpdmUgPSBmYWxzZVxuICAgIEB0c2xpZGVyLmhhbmRsZS5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnJylcblxuICBvbl9tb3VzZXVwX2NhbnZhczogKGV2ZW50KSA9PlxuICAgIGZvciBwIGZyb20gQGN1cnZlLmVhY2hfcG9pbnQoKVxuICAgICAgcC5zZWxlY3RlZCA9IGZhbHNlXG5cbiAgICBpZiBAcG9pbnRfaGFzX2NoYW5nZWRcbiAgICAgIEB1cGRhdGVfYWxnb3JpdGhtKClcblxuICBvbl9tb3VzZXVwOiAoZXZlbnQpID0+XG4gICAgaWYgQHRzbGlkZXIuZHJhZ19hY3RpdmVcbiAgICAgIEBvbl9tb3VzZXVwX3RzbGlkZXIoZXZlbnQpXG4gICAgZWxzZVxuICAgICAgQG9uX21vdXNldXBfY2FudmFzKGV2ZW50KVxuXG4gIG9uX2tleWRvd246IChldmVudCkgPT5cbiAgICBzd2l0Y2ggZXZlbnQua2V5XG4gICAgICB3aGVuIFwiU2hpZnRcIiB0aGVuIEBzaGlmdCA9IHRydWVcblxuICBvbl9rZXl1cDogKGV2ZW50KSA9PlxuICAgIHN3aXRjaCBldmVudC5rZXlcbiAgICAgIHdoZW4gXCJTaGlmdFwiIHRoZW4gQHNoaWZ0ID0gZmFsc2VcblxuICBkcmF3OiA9PlxuICAgIEBjdXJ2ZS5kcmF3KClcblxuICByZWRyYXdfdWk6IChyZW5kZXJfYml0bWFwX3ByZXZpZXcgPSB0cnVlKSA9PlxuICAgIEBncmFwaF91aV9jdHguY2xlYXJSZWN0KDAsIDAsIEBncmFwaF91aV9jYW52YXMud2lkdGgsIEBncmFwaF91aV9jYW52YXMuaGVpZ2h0KVxuXG4gICAgZm9yIG9yZGVyIGluIEBjYW52YXMucG9pbnRzXG4gICAgICBmb3IgcCBpbiBvcmRlclxuICAgICAgICBwLmRyYXdfdWkoKVxuXG4gICAgcmV0dXJuIG51bGxcblxuICB1cGRhdGVfYXQ6ICh0KSA9PlxuICAgIEBjdXJ2ZS51cGRhdGVfYXQodClcblxuICB1cGRhdGU6ID0+XG4gICAgQHVwZGF0ZV9hdChAdClcblxuICB1cGRhdGVfYW5kX2RyYXc6IC0+XG4gICAgQGdyYXBoX2N0eC5jbGVhclJlY3QoMCwgMCwgQGdyYXBoX2NhbnZhcy53aWR0aCwgQGdyYXBoX2NhbnZhcy5oZWlnaHQpXG4gICAgQGN1cnZlLmRyYXdfdGlja3MoKSBpZiBAb3B0aW9uLnNob3dfdGlja3MudmFsdWVcbiAgICBAY3VydmUuZHJhd19jdXJ2ZSgpXG4gICAgQHVwZGF0ZSgpXG4gICAgQGN1cnZlLmRyYXcoKVxuICAgIEBjdXJ2ZS5kcmF3X3BlbigpIGlmIEBvcHRpb24uc2hvd19wZW5fbGFiZWwudmFsdWVcblxuICB1cGRhdGVfY2FsbGJhY2s6ICh0aW1lc3RhbXApID0+XG4gICAgQGZyYW1lX2lzX3NjaGVkdWxlZCA9IGZhbHNlXG4gICAgZWxhcHNlZCA9IHRpbWVzdGFtcCAtIEBwcmV2X2FuaW1fdGltZXN0YW1wXG4gICAgaWYgZWxhcHNlZCA+IDBcbiAgICAgIEBwcmV2X2FuaW1fdGltZXN0YW1wID0gQGFuaW1fdGltZXN0YW1wXG4gICAgICAjY29uc29sZS5sb2coJ3QnLCBAdCwgJ3RfcmVhbCcsIEB0X3JlYWwsICd0X3BlcmMnLCBAdF9wZXJjLCAndF9zdGVwJywgQHRfc3RlcClcbiAgICAgIEBzZXRfdF9wZXJjKCBAdF9wZXJjICsgQHRfc3RlcCApXG4gICAgICBAc2V0X3RzbGlkZXJfcG9zaXRpb24oQHRzbGlkZXIubWluICsgKEB0X3BlcmMgKiBAdHNsaWRlci5yYW5nZSkpXG4gICAgICBAdXBkYXRlX2FuZF9kcmF3KClcblxuICAgIEBzY2hlZHVsZV9uZXh0X2ZyYW1lKCkgaWYgQHJ1bm5pbmdcbiAgICByZXR1cm4gbnVsbFxuXG4gIHNjaGVkdWxlX25leHRfZnJhbWU6ID0+XG4gICAgaWYgQHJ1bm5pbmdcbiAgICAgIHVubGVzcyBAZnJhbWVfaXNfc2NoZWR1bGVkXG4gICAgICAgIEBmcmFtZV9pc19zY2hlZHVsZWQgPSB0cnVlXG4gICAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoQHVwZGF0ZV9jYWxsYmFjaylcbiAgICByZXR1cm4gbnVsbFxuXG4gIGZpcnN0X3VwZGF0ZV9jYWxsYmFjazogKHRpbWVzdGFtcCkgPT5cbiAgICBAYW5pbV90aW1lc3RhbXAgICAgICA9IHRpbWVzdGFtcFxuICAgIEBwcmV2X2FuaW1fdGltZXN0YW1wID0gdGltZXN0YW1wXG4gICAgQGZyYW1lX2lzX3NjaGVkdWxlZCA9IGZhbHNlXG4gICAgQHNjaGVkdWxlX25leHRfZnJhbWUoKVxuICAgXG4gIHNjaGVkdWxlX2ZpcnN0X2ZyYW1lOiA9PlxuICAgIGlmIEBydW5uaW5nXG4gICAgICBAZnJhbWVfaXNfc2NoZWR1bGVkID0gdHJ1ZVxuICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShAZmlyc3RfdXBkYXRlX2NhbGxiYWNrKVxuICAgIHJldHVybiBudWxsXG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIgJ0RPTUNvbnRlbnRMb2FkZWQnLCA9PlxuICB3aW5kb3cuQVBQID0gbmV3IExFUlBpbmdTcGxpbmVzKGRvY3VtZW50KVxuICB3aW5kb3cuQVBQLmluaXQoKVxuICB3aW5kb3cuQVBQLmRyYXcoKVxuY2xvbmUgPSAob2JqKSAtPlxuICAjIGZyb206IGh0dHBzOi8vY29mZmVlc2NyaXB0LWNvb2tib29rLmdpdGh1Yi5pby9jaGFwdGVycy9jbGFzc2VzX2FuZF9vYmplY3RzL2Nsb25pbmdcbiAgaWYgbm90IG9iaj8gb3IgdHlwZW9mIG9iaiBpc250ICdvYmplY3QnXG4gICAgcmV0dXJuIG9ialxuXG4gIGlmIG9iaiBpbnN0YW5jZW9mIERhdGVcbiAgICByZXR1cm4gbmV3IERhdGUob2JqLmdldFRpbWUoKSkgXG5cbiAgaWYgb2JqIGluc3RhbmNlb2YgUmVnRXhwXG4gICAgZmxhZ3MgPSAnJ1xuICAgIGZsYWdzICs9ICdnJyBpZiBvYmouZ2xvYmFsP1xuICAgIGZsYWdzICs9ICdpJyBpZiBvYmouaWdub3JlQ2FzZT9cbiAgICBmbGFncyArPSAnbScgaWYgb2JqLm11bHRpbGluZT9cbiAgICBmbGFncyArPSAneScgaWYgb2JqLnN0aWNreT9cbiAgICByZXR1cm4gbmV3IFJlZ0V4cChvYmouc291cmNlLCBmbGFncykgXG5cbiAgbmV3SW5zdGFuY2UgPSBuZXcgb2JqLmNvbnN0cnVjdG9yKClcblxuICBmb3Iga2V5IG9mIG9ialxuICAgIG5ld0luc3RhbmNlW2tleV0gPSBjbG9uZSBvYmpba2V5XVxuXG4gIHJldHVybiBuZXdJbnN0YW5jZVxuXG5jbGFzcyBWZWMyXG4gIEBsZXJwOiAoYSwgYiwgYW1vdW50KSAtPlxuICAgIHJldHVyblxuICAgICAgeDogYS54ICsgKGFtb3VudCAqIChiLnggLSBhLngpKVxuICAgICAgeTogYS55ICsgKGFtb3VudCAqIChiLnkgLSBhLnkpKVxuXG4gIEBtYWduaXR1ZGU6ICh2KSAtPlxuICAgIE1hdGguc3FydCgodi54ICogdi54KSArICh2LnkgKiB2LnkpKVxuXG4gIEBhZGQ6IChhLCBiKSAtPlxuICAgIHJldHVyblxuICAgICAgeDogYS54ICsgYi54XG4gICAgICB5OiBhLnkgKyBiLnlcblxuICBAc3ViOiAoYSwgYikgLT5cbiAgICByZXR1cm5cbiAgICAgIHg6IGEueCAtIGIueFxuICAgICAgeTogYS55IC0gYi55XG5cbiAgQHNjYWxlOiAodiwgc2NhbGUpIC0+XG4gICAgcmV0dXJuXG4gICAgICB4OiB2LnggKiBzY2FsZVxuICAgICAgeTogdi55ICogc2NhbGVcblxuICBAcm90YXRlOiAodiwgYW5nbGUpIC0+XG4gICAgYyA9IE1hdGguY29zKGFuZ2xlKVxuICAgIHMgPSBNYXRoLnNpbihhbmdsZSlcbiAgICByZXR1cm5cbiAgICAgIHg6ICh2LnggKiBjKSAtICh2LnkgKiBzKVxuICAgICAgeTogKHYueCAqIHMpICsgKHYueSAqIGMpXG5cbiAgQG5vcm1hbGl6ZTogKHYpIC0+XG4gICAgcmVzdWx0ID1cbiAgICAgIHg6IDAuMFxuICAgICAgeTogMC4wXG5cbiAgICBsZW5ndGggPSBNYXRoLnNxcnQoKHYueCp2LngpICsgKHYueSp2LnkpKVxuXG4gICAgaWYgbGVuZ3RoID4gMFxuICAgICAgaWxlbmd0aCA9IDEuMCAvIGxlbmd0aDtcbiAgICAgIHJlc3VsdC54ID0gdi54ICogaWxlbmd0aFxuICAgICAgcmVzdWx0LnkgPSB2LnkgKiBpbGVuZ3RoXG5cbiAgICByZXN1bHRcblxuYFxuLyogY29waWVkIGZyb206IGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9Qb21heC9iZXppZXJpbmZvL3JlZnMvaGVhZHMvbWFzdGVyL2pzL2dyYXBoaWNzLWVsZW1lbnQvYXBpL3R5cGVzL21hdHJpeC5qcyAqL1xuXG5mdW5jdGlvbiBpbnZlcnQoTSkge1xuICAvLyBDb3BpZWQgZnJvbSBodHRwOi8vYmxvZy5hY2lwby5jb20vbWF0cml4LWludmVyc2lvbi1pbi1qYXZhc2NyaXB0L1xuICAvLyBXaXRoIHBlcm1pc3Npb24sIGh0dHA6Ly9ibG9nLmFjaXBvLmNvbS9tYXRyaXgtaW52ZXJzaW9uLWluLWphdmFzY3JpcHQvI2NvbW1lbnQtNTA1NzI4OTg4OVxuXG4gIC8vICgxKSAnYXVnbWVudCcgdGhlIG1hdHJpeCAobGVmdCkgYnkgdGhlIGlkZW50aXR5IChvbiB0aGUgcmlnaHQpXG4gIC8vICgyKSBUdXJuIHRoZSBtYXRyaXggb24gdGhlIGxlZnQgaW50byB0aGUgaWRlbnRpdHkgYnkgZWxlbWV0cnkgcm93IG9wc1xuICAvLyAoMykgVGhlIG1hdHJpeCBvbiB0aGUgcmlnaHQgaXMgdGhlIGludmVyc2UgKHdhcyB0aGUgaWRlbnRpdHkgbWF0cml4KVxuICAvLyBUaGVyZSBhcmUgMyBlbGVtdGFyeSByb3cgb3BzOlxuICAvLyAoYSkgU3dhcCAyIHJvd3NcbiAgLy8gKGIpIE11bHRpcGx5IGEgcm93IGJ5IGEgc2NhbGFyXG4gIC8vIChjKSBBZGQgMiByb3dzXG5cbiAgLy9pZiB0aGUgbWF0cml4IGlzbid0IHNxdWFyZTogZXhpdCAoZXJyb3IpXG4gIGlmIChNLmxlbmd0aCAhPT0gTVswXS5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmxvZyhcIm5vdCBzcXVhcmVcIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy9jcmVhdGUgdGhlIGlkZW50aXR5IG1hdHJpeCAoSSksIGFuZCBhIGNvcHkgKEMpIG9mIHRoZSBvcmlnaW5hbFxuICB2YXIgaSA9IDAsXG4gICAgaWkgPSAwLFxuICAgIGogPSAwLFxuICAgIGRpbSA9IE0ubGVuZ3RoLFxuICAgIGUgPSAwLFxuICAgIHQgPSAwO1xuICB2YXIgSSA9IFtdLFxuICAgIEMgPSBbXTtcbiAgZm9yIChpID0gMDsgaSA8IGRpbTsgaSArPSAxKSB7XG4gICAgLy8gQ3JlYXRlIHRoZSByb3dcbiAgICBJW0kubGVuZ3RoXSA9IFtdO1xuICAgIENbQy5sZW5ndGhdID0gW107XG4gICAgZm9yIChqID0gMDsgaiA8IGRpbTsgaiArPSAxKSB7XG4gICAgICAvL2lmIHdlJ3JlIG9uIHRoZSBkaWFnb25hbCwgcHV0IGEgMSAoZm9yIGlkZW50aXR5KVxuICAgICAgaWYgKGkgPT0gaikge1xuICAgICAgICBJW2ldW2pdID0gMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIElbaV1bal0gPSAwO1xuICAgICAgfVxuXG4gICAgICAvLyBBbHNvLCBtYWtlIHRoZSBjb3B5IG9mIHRoZSBvcmlnaW5hbFxuICAgICAgQ1tpXVtqXSA9IE1baV1bal07XG4gICAgfVxuICB9XG5cbiAgLy8gUGVyZm9ybSBlbGVtZW50YXJ5IHJvdyBvcGVyYXRpb25zXG4gIGZvciAoaSA9IDA7IGkgPCBkaW07IGkgKz0gMSkge1xuICAgIC8vIGdldCB0aGUgZWxlbWVudCBlIG9uIHRoZSBkaWFnb25hbFxuICAgIGUgPSBDW2ldW2ldO1xuXG4gICAgLy8gaWYgd2UgaGF2ZSBhIDAgb24gdGhlIGRpYWdvbmFsICh3ZSdsbCBuZWVkIHRvIHN3YXAgd2l0aCBhIGxvd2VyIHJvdylcbiAgICBpZiAoZSA9PSAwKSB7XG4gICAgICAvL2xvb2sgdGhyb3VnaCBldmVyeSByb3cgYmVsb3cgdGhlIGkndGggcm93XG4gICAgICBmb3IgKGlpID0gaSArIDE7IGlpIDwgZGltOyBpaSArPSAxKSB7XG4gICAgICAgIC8vaWYgdGhlIGlpJ3RoIHJvdyBoYXMgYSBub24tMCBpbiB0aGUgaSd0aCBjb2xcbiAgICAgICAgaWYgKENbaWldW2ldICE9IDApIHtcbiAgICAgICAgICAvL2l0IHdvdWxkIG1ha2UgdGhlIGRpYWdvbmFsIGhhdmUgYSBub24tMCBzbyBzd2FwIGl0XG4gICAgICAgICAgZm9yIChqID0gMDsgaiA8IGRpbTsgaisrKSB7XG4gICAgICAgICAgICBlID0gQ1tpXVtqXTsgLy90ZW1wIHN0b3JlIGkndGggcm93XG4gICAgICAgICAgICBDW2ldW2pdID0gQ1tpaV1bal07IC8vcmVwbGFjZSBpJ3RoIHJvdyBieSBpaSd0aFxuICAgICAgICAgICAgQ1tpaV1bal0gPSBlOyAvL3JlcGFjZSBpaSd0aCBieSB0ZW1wXG4gICAgICAgICAgICBlID0gSVtpXVtqXTsgLy90ZW1wIHN0b3JlIGkndGggcm93XG4gICAgICAgICAgICBJW2ldW2pdID0gSVtpaV1bal07IC8vcmVwbGFjZSBpJ3RoIHJvdyBieSBpaSd0aFxuICAgICAgICAgICAgSVtpaV1bal0gPSBlOyAvL3JlcGFjZSBpaSd0aCBieSB0ZW1wXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vZG9uJ3QgYm90aGVyIGNoZWNraW5nIG90aGVyIHJvd3Mgc2luY2Ugd2UndmUgc3dhcHBlZFxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvL2dldCB0aGUgbmV3IGRpYWdvbmFsXG4gICAgICBlID0gQ1tpXVtpXTtcbiAgICAgIC8vaWYgaXQncyBzdGlsbCAwLCBub3QgaW52ZXJ0YWJsZSAoZXJyb3IpXG4gICAgICBpZiAoZSA9PSAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTY2FsZSB0aGlzIHJvdyBkb3duIGJ5IGUgKHNvIHdlIGhhdmUgYSAxIG9uIHRoZSBkaWFnb25hbClcbiAgICBmb3IgKGogPSAwOyBqIDwgZGltOyBqKyspIHtcbiAgICAgIENbaV1bal0gPSBDW2ldW2pdIC8gZTsgLy9hcHBseSB0byBvcmlnaW5hbCBtYXRyaXhcbiAgICAgIElbaV1bal0gPSBJW2ldW2pdIC8gZTsgLy9hcHBseSB0byBpZGVudGl0eVxuICAgIH1cblxuICAgIC8vIFN1YnRyYWN0IHRoaXMgcm93IChzY2FsZWQgYXBwcm9wcmlhdGVseSBmb3IgZWFjaCByb3cpIGZyb20gQUxMIG9mXG4gICAgLy8gdGhlIG90aGVyIHJvd3Mgc28gdGhhdCB0aGVyZSB3aWxsIGJlIDAncyBpbiB0aGlzIGNvbHVtbiBpbiB0aGVcbiAgICAvLyByb3dzIGFib3ZlIGFuZCBiZWxvdyB0aGlzIG9uZVxuICAgIGZvciAoaWkgPSAwOyBpaSA8IGRpbTsgaWkrKykge1xuICAgICAgLy8gT25seSBhcHBseSB0byBvdGhlciByb3dzICh3ZSB3YW50IGEgMSBvbiB0aGUgZGlhZ29uYWwpXG4gICAgICBpZiAoaWkgPT0gaSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gV2Ugd2FudCB0byBjaGFuZ2UgdGhpcyBlbGVtZW50IHRvIDBcbiAgICAgIGUgPSBDW2lpXVtpXTtcblxuICAgICAgLy8gU3VidHJhY3QgKHRoZSByb3cgYWJvdmUob3IgYmVsb3cpIHNjYWxlZCBieSBlKSBmcm9tICh0aGVcbiAgICAgIC8vIGN1cnJlbnQgcm93KSBidXQgc3RhcnQgYXQgdGhlIGkndGggY29sdW1uIGFuZCBhc3N1bWUgYWxsIHRoZVxuICAgICAgLy8gc3R1ZmYgbGVmdCBvZiBkaWFnb25hbCBpcyAwICh3aGljaCBpdCBzaG91bGQgYmUgaWYgd2UgbWFkZSB0aGlzXG4gICAgICAvLyBhbGdvcml0aG0gY29ycmVjdGx5KVxuICAgICAgZm9yIChqID0gMDsgaiA8IGRpbTsgaisrKSB7XG4gICAgICAgIENbaWldW2pdIC09IGUgKiBDW2ldW2pdOyAvL2FwcGx5IHRvIG9yaWdpbmFsIG1hdHJpeFxuICAgICAgICBJW2lpXVtqXSAtPSBlICogSVtpXVtqXTsgLy9hcHBseSB0byBpZGVudGl0eVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vd2UndmUgZG9uZSBhbGwgb3BlcmF0aW9ucywgQyBzaG91bGQgYmUgdGhlIGlkZW50aXR5XG4gIC8vbWF0cml4IEkgc2hvdWxkIGJlIHRoZSBpbnZlcnNlOlxuICByZXR1cm4gSTtcbn1cblxuZnVuY3Rpb24gbXVsdGlwbHkobTEsIG0yKSB7XG4gIHZhciBNID0gW107XG4gIHZhciBtMnQgPSB0cmFuc3Bvc2UobTIpO1xuICBtMS5mb3JFYWNoKChyb3csIHIpID0+IHtcbiAgICBNW3JdID0gW107XG4gICAgbTJ0LmZvckVhY2goKGNvbCwgYykgPT4ge1xuICAgICAgTVtyXVtjXSA9IHJvdy5tYXAoKHYsIGkpID0+IGNvbFtpXSAqIHYpLnJlZHVjZSgoYSwgdikgPT4gYSArIHYsIDApO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIE07XG59XG5cbmZ1bmN0aW9uIHRyYW5zcG9zZShNKSB7XG4gIHJldHVybiBNWzBdLm1hcCgoY29sLCBpKSA9PiBNLm1hcCgocm93KSA9PiByb3dbaV0pKTtcbn1cblxuY2xhc3MgTWF0cml4IHtcbiAgY29uc3RydWN0b3IobiwgbSwgZGF0YSkge1xuICAgIGRhdGEgPSBuIGluc3RhbmNlb2YgQXJyYXkgPyBuIDogZGF0YTtcbiAgICB0aGlzLmRhdGEgPSBkYXRhID8/IFsuLi5uZXcgQXJyYXkobildLm1hcCgodikgPT4gWy4uLm5ldyBBcnJheShtKV0ubWFwKCh2KSA9PiAwKSk7XG4gICAgdGhpcy5yb3dzID0gdGhpcy5kYXRhLmxlbmd0aDtcbiAgICB0aGlzLmNvbHMgPSB0aGlzLmRhdGFbMF0ubGVuZ3RoO1xuICB9XG4gIHNldERhdGEoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gIH1cbiAgZ2V0KGksIGopIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhW2ldW2pdO1xuICB9XG4gIHNldChpLCBqLCB2YWx1ZSkge1xuICAgIHRoaXMuZGF0YVtpXVtqXSA9IHZhbHVlO1xuICB9XG4gIHJvdyhpKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YVtpXTtcbiAgfVxuICBjb2woaikge1xuICAgIHZhciBkID0gdGhpcy5kYXRhLFxuICAgICAgY29sID0gW107XG4gICAgZm9yIChsZXQgciA9IDAsIGwgPSBkLmxlbmd0aDsgciA8IGw7IHIrKykge1xuICAgICAgY29sLnB1c2goZFtyXVtqXSk7XG4gICAgfVxuICAgIHJldHVybiBjb2w7XG4gIH1cbiAgbXVsdGlwbHkob3RoZXIpIHtcbiAgICByZXR1cm4gbmV3IE1hdHJpeChtdWx0aXBseSh0aGlzLmRhdGEsIG90aGVyLmRhdGEpKTtcbiAgfVxuICBpbnZlcnQoKSB7XG4gICAgcmV0dXJuIG5ldyBNYXRyaXgoaW52ZXJ0KHRoaXMuZGF0YSkpO1xuICB9XG4gIHRyYW5zcG9zZSgpIHtcbiAgICByZXR1cm4gbmV3IE1hdHJpeCh0cmFuc3Bvc2UodGhpcy5kYXRhKSk7XG4gIH1cbn1cblxuLypleHBvcnQgeyBNYXRyaXggfTsqL1xuYFxuIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjXG4jICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNcbiMgIHBvaW50LmNvZmZlZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI1xuIyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjXG4jICBUaGlzIGZpbGUgaXMgcGFydCBvZiBsZXJwaW5nX3NwbGluZXMuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNcbiMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI1xuIyAgbGVycGluZ19zcGxpbmVzIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciAgICAgICAgICAjXG4jICBtb2RpZnkgaXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgICNcbiMgIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsICAgICAgICAgI1xuIyAgb3IgKGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjXG4jICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNcbiMgIGxlcnBpbmdfc3BsaW5lcyBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCAgICAgICAgI1xuIyAgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgICAgICAgICAgICAjXG4jICBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuIFNlZSB0aGUgR05VIEdlbmVyYWwgICNcbiMgIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI1xuIyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjXG4jICBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyAgICNcbiMgIHdpdGggbGVycGluZ19zcGxpbmVzLiBJZiBub3QsIHNlZSA8aHR0cHM6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+LiAgICAgICAgI1xuIyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjXG4jIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyNcblxuY2xhc3MgUG9pbnRcbiAgY29uc3RydWN0b3I6IChAY29sb3IpIC0+XG4gICAgQHJlc2V0KClcblxuICAgIEBvcmRlciA9IDBcbiAgICBAcmFkaXVzID0gTEVSUGluZ1NwbGluZXMucG9pbnRfcmFkaXVzXG4gICAgQGNvbG9yID89ICcjMDAwJ1xuICAgIEBsYWJlbF9jb2xvciA/PSAnIzAwMCdcbiAgICBAc2hvd19sYWJlbCA9IHRydWVcblxuICAgIEBzZXRfcmFuZG9tX3Bvc2l0aW9uKClcblxuICAgIEBwb3NpdGlvbiA9XG4gICAgICB4OiBAeFxuICAgICAgeTogQHlcblxuICAgIEBsYWJlbF9wb3NpdGlvbiA9XG4gICAgICB4OiBAeFxuICAgICAgeTogQHlcblxuICByZXNldDogLT5cbiAgICBAZW5hYmxlZCA9IGZhbHNlO1xuICAgIEBob3ZlciA9IGZhbHNlXG4gICAgQHNlbGVjdGVkID0gZmFsc2VcblxuICBzZXRfbGFiZWw6IChAbGFiZWwpIC0+XG4gICAgQGxhYmVsX21ldHJpY3MgPSBBUFAuZ3JhcGhfY3R4Lm1lYXN1cmVUZXh0KEBsYWJlbClcbiAgICBAbGFiZWxfd2lkdGggICA9IEBsYWJlbF9tZXRyaWNzLndpZHRoXG4gICAgQGxhYmVsX2hlaWdodCAgPSBMRVJQaW5nU3BsaW5lcy5wb2ludF9sYWJlbF9oZWlnaHRcblxuICBnZXRfbGFiZWw6IC0+XG4gICAgQGxhYmVsXG5cbiAgc2V0X3JhbmRvbV9wb3NpdGlvbjogLT5cbiAgICBAc2V0X2ZyYWN0X3Bvc2l0aW9uKE1hdGgucmFuZG9tKCksIE1hdGgucmFuZG9tKCkpXG5cbiAgc2V0X2ZyYWN0X3Bvc2l0aW9uOiAoeCwgeSkgLT5cbiAgICBtYXJnaW4gPSBMRVJQaW5nU3BsaW5lcy5jcmVhdGVfcG9pbnRfbWFyZ2luXG4gICAgcmFuZ2UgPSAxLjAgLSAoMi4wICogbWFyZ2luKVxuXG4gICAgeCA9IG1hcmdpbiArIChyYW5nZSAqIHgpXG4gICAgeSA9IG1hcmdpbiArIChyYW5nZSAqIHkpXG5cbiAgICBAbW92ZSh4ICogQVBQLmdyYXBoX3dpZHRoLCB5ICogQVBQLmdyYXBoX2hlaWdodClcblxuICBtb3ZlOiAoeCwgeSkgLT5cbiAgICBAeCA9IHhcbiAgICBAeSA9IHlcblxuICBjb250YWluczogKHgsIHkpIC0+XG4gICAgZHggPSBAeCAtIHhcbiAgICBkeSA9IEB5IC0geVxuICAgIGRpc3QgPSBNYXRoLnNxcnQoKGR4ICogZHgpICsgKGR5ICogZHkpKVxuICAgIHJldHVybiBkaXN0IDw9IEByYWRpdXMgKyBMRVJQaW5nU3BsaW5lcy5tb3VzZW92ZXJfcG9pbnRfcmFkaXVzX2Jvb3N0XG5cbiAgbWlycm9yX2Fyb3VuZF9wcmV2X2tub3Q6IC0+XG4gICAgZGVsdGEgPSBWZWMyLnN1YihAcHJldiwgQHByZXYucHJldilcbiAgICBuZXdwb3MgPSBWZWMyLmFkZChAcHJldiwgZGVsdGEpXG4gICAgQHggPSBuZXdwb3MueFxuICAgIEB5ID0gbmV3cG9zLnlcblxuICBtaXJyb3JfYXJvdW5kX25leHRfa25vdDogLT5cbiAgICBkZWx0YSA9IFZlYzIuc3ViKEBuZXh0LCBAbmV4dC5uZXh0KVxuICAgIG5ld3BvcyA9IFZlYzIuYWRkKEBuZXh0LCBkZWx0YSlcbiAgICBAeCA9IG5ld3Bvcy54XG4gICAgQHkgPSBuZXdwb3MueVxuXG5cbiAgbWlycm9yX2Fyb3VuZF9rbm90OiAtPlxuICAgIGlmIEBwcmV2PyBhbmQgQHByZXYucHJldj8gYW5kIEBwcmV2Lmtub3RcbiAgICAgIEBtaXJyb3JfYXJvdW5kX3ByZXZfa25vdCgpXG4gICAgZWxzZSBpZiBAbmV4dD8gYW5kIEBuZXh0Lm5leHQ/IGFuZCBAbmV4dC5rbm90XG4gICAgICBAbWlycm9yX2Fyb3VuZF9uZXh0X2tub3QoKVxuXG4gIHVwZGF0ZTogKHQpIC0+XG4gICAgQHBvc2l0aW9uLnggPSBAeFxuICAgIEBwb3NpdGlvbi55ID0gQHlcblxuICAgICMjIyMjIyMjIyMjIyMjIyMjIyNcbiAgICAjIFhcblxuICAgIEB4X2lzX2xlZnQgPSB0cnVlXG5cbiAgICBpZiAoQHBvc2l0aW9uLnggPiAoQVBQLmdyYXBoX3dpZHRoIC8gMi4wKSkgYW5kIChAcG9zaXRpb24ueCA8IEFQUC5wb2ludF9sYWJlbF9mbGlwX21hcmdpbi5tYXhfeClcbiAgICAgIEB4X2lzX2xlZnQgPSBmYWxzZVxuXG4gICAgaWYgQHBvc2l0aW9uLnggPD0gQVBQLnBvaW50X2xhYmVsX2ZsaXBfbWFyZ2luLm1pbl94XG4gICAgICBAeF9pc19sZWZ0ID0gZmFsc2VcblxuICAgIGlmIEB4X2lzX2xlZnRcbiAgICAgIEBsYWJlbF9wb3NpdGlvbi54ID0gQHBvc2l0aW9uLnggLSBAbGFiZWxfd2lkdGggLSAxM1xuICAgIGVsc2VcbiAgICAgIEBsYWJlbF9wb3NpdGlvbi54ID0gQHBvc2l0aW9uLnggKyBAbGFiZWxfd2lkdGggLSAxXG5cbiAgICAjIyMjIyMjIyMjIyMjIyMjIyMjXG4gICAgIyBZXG5cbiAgICBAeV9pc190b3AgPSB0cnVlXG5cbiAgICBpZiAoQHBvc2l0aW9uLnkgPiAoQVBQLmdyYXBoX2hlaWdodCAvIDIuMCkpIGFuZCAoQHBvc2l0aW9uLnkgPCBBUFAucG9pbnRfbGFiZWxfZmxpcF9tYXJnaW4ubWF4X3kpXG4gICAgICBAeV9pc190b3AgPSBmYWxzZVxuXG4gICAgaWYgQHBvc2l0aW9uLnkgPD0gQVBQLnBvaW50X2xhYmVsX2ZsaXBfbWFyZ2luLm1pbl95XG4gICAgICBAeV9pc190b3AgPSBmYWxzZVxuXG4gICAgaWYgQHlfaXNfdG9wXG4gICAgICBAbGFiZWxfcG9zaXRpb24ueSA9IEBwb3NpdGlvbi55IC0gQGxhYmVsX2hlaWdodCArIDJcbiAgICBlbHNlXG4gICAgICBAbGFiZWxfcG9zaXRpb24ueSA9IEBwb3NpdGlvbi55ICsgQGxhYmVsX2hlaWdodCArIDhcblxuICBkcmF3OiAtPlxuICAgIHJldHVybiB1bmxlc3MgQGVuYWJsZWRcblxuICAgICNjb25zb2xlLmxvZygnZHJhdyBwb2ludCcsIEB4LCBAeSwgQGNvbG9yKVxuICAgIGN0eCA9IEFQUC5ncmFwaF9jdHhcblxuICAgIHJhZGl1cyA9IEByYWRpdXMgPSA1XG4gICAgaW5uZXJfcmFkaXVzID0gcmFkaXVzICogMC44XG5cbiAgICBpZiBAaG92ZXJcbiAgICAgIGN0eC5iZWdpblBhdGgoKVxuICAgICAgY3R4LmZpbGxTdHlsZSA9ICcjZmYwJ1xuICAgICAgY3R4LnN0cm9rZVN0eWxlID0gJyMwMDAnXG4gICAgICBjdHgubGluZVdpZHRoID0gMVxuICAgICAgY3R4LmFyYyhAeCwgQHksIHJhZGl1cyAqIDMsIDAsIFRBVSlcbiAgICAgIGN0eC5maWxsKClcbiAgICAgIGN0eC5zdHJva2UoKVxuICAgICAgcmFkaXVzICo9IDEuNVxuICAgICAgaW5uZXJfcmFkaXVzID0gQHJhZGl1cyAqIDAuN1xuXG4gICAgY3R4LmJlZ2luUGF0aCgpXG5cbiAgICBpZiBBUFAuc3BsaW5lX21vZGUgJiYgIUBrbm90XG4gICAgICBjdHguYXJjKEB4LCBAeSwgaW5uZXJfcmFkaXVzLCAwLCBUQVUsIHRydWUpXG5cbiAgICBjdHguYXJjKEB4LCBAeSwgcmFkaXVzLCAwLCBUQVUpXG5cbiAgICBjdHguZmlsbFN0eWxlID0gQGNvbG9yXG4gICAgY3R4LmZpbGwoKVxuXG4gICAgaWYgQGxhYmVsICYmIEBzaG93X2xhYmVsXG4gICAgICBjdHguZmlsbFN0eWxlID0gQGxhYmVsX2NvbG9yXG4gICAgICBjdHguZmlsbFRleHQoQGxhYmVsLCBAbGFiZWxfcG9zaXRpb24ueCwgQGxhYmVsX3Bvc2l0aW9uLnkpO1xuXG5cbmNsYXNzIExFUlAgZXh0ZW5kcyBQb2ludFxuICBjb25zdHJ1Y3RvcjogKEBvcmRlciwgQGZyb20sIEB0bykgLT5cbiAgICBAZW5hYmxlZCA9IGZhbHNlXG5cbiAgICBAcmFkaXVzID0gNVxuXG4gICAgQGNvbG9yID0gc3dpdGNoIEBvcmRlclxuICAgICAgd2hlbiAxIHRoZW4gJyM0NTFDOTInXG4gICAgICB3aGVuIDIgdGhlbiAnIzJENDJEQydcbiAgICAgIHdoZW4gMyB0aGVuICcjQTI0M0RDJ1xuICAgICAgd2hlbiA0IHRoZW4gJyNENDQxNDMnXG4gICAgICB3aGVuIDUgdGhlbiAnI0Q5OEY0NidcbiAgICAgIHdoZW4gNiB0aGVuICcjNzBEOTQyJ1xuICAgICAgd2hlbiA3IHRoZW4gJyM2RTU1RkYnXG4gICAgICBlbHNlICcjNTU1J1xuXG4gICAgI0Bjb2xvciA9IFwicmdiKCN7Y29sb3JfZnJhY3R9LCN7Y29sb3JfZnJhY3R9LCN7Y29sb3JfZnJhY3R9KVwiXG4gICAgI2NvbnNvbGUubG9nKFwibGVycDwje0BvcmRlcn0+IGNvbG9yXCIsIEBjb2xvcilcblxuICAgIEBwb3NpdGlvbiA9XG4gICAgICB4OiBAZnJvbS54XG4gICAgICB5OiBAZnJvbS55XG5cbiAgICBAcHJldl9wb3NpdGlvbiA9XG4gICAgICB4OiBudWxsXG4gICAgICB5OiBudWxsXG5cbiAgZ2VuZXJhdGVfbGFiZWw6IChvcmRlciwgaW5kZXgpIC0+XG4gICAgQGxhYmVsID0gXCIje0Bmcm9tLmxhYmVsfSN7QHRvLmxhYmVsfVwiXG4gICAgQGFsZ19sYWJlbCA9IFwidGVtcF8je29yZGVyfV8je2luZGV4fVwiXG5cbiAgZ2V0X2xhYmVsOiAtPlxuICAgIGlmIEFQUC5vcHRpb24uYWx0X2FsZ29yaXRobV9uYW1lcy52YWx1ZVxuICAgICAgQGxhYmVsXG4gICAgZWxzZVxuICAgICAgQGFsZ19sYWJlbFxuXG4gIGludGVycG9sYXRlOiAodCwgYSwgYikgLT5cbiAgICAodCAqIGIpICsgKCgxIC0gdCkgKiBhKVxuXG4gIHVwZGF0ZTogKHQpIC0+XG4gICAgQGVuYWJsZWQgPSBAZnJvbS5lbmFibGVkIGFuZCBAdG8uZW5hYmxlZFxuICAgICNyZXR1cm4gdW5sZXNzIEBlbmFibGVkXG5cbiAgICAjY29uc29sZS5sb2coXCJ1cGRhdGUgbGVycDwje0BvcmRlcn0+IHQ9I3t0fVwiKVxuICAgIEBwb3NpdGlvbi54ID0gQGludGVycG9sYXRlKHQsIEBmcm9tLnBvc2l0aW9uLngsIEB0by5wb3NpdGlvbi54KVxuICAgIEBwb3NpdGlvbi55ID0gQGludGVycG9sYXRlKHQsIEBmcm9tLnBvc2l0aW9uLnksIEB0by5wb3NpdGlvbi55KVxuICAgICNjb25zb2xlLmxvZygnZnJvbScsIEBmcm9tKVxuICAgICNjb25zb2xlLmxvZygndG8nLCBAdG8pXG4gICAgI2NvbnNvbGUubG9nKFwicG9zaXRpb24gPSBbI3tAcG9zaXRpb24ueH0sI3tAcG9zaXRpb24ueX1dXCIpXG5cbiAgZHJhdzogLT5cbiAgICByZXR1cm4gdW5sZXNzIEBlbmFibGVkXG5cbiAgICAjY29uc29sZS5sb2coXCJkcmF3IGxlcnA8I3tAb3JkZXJ9PiBhdCBbI3tAcG9zaXRpb24ueH0sI3tAcG9zaXRpb24ueX1dXCIpXG4gICAgY3R4ID0gQVBQLmdyYXBoX2N0eFxuXG4gICAgZHJhd19mcm9tX3RvX2xpbmUgPSB0cnVlXG5cbiAgICAjIGlmIEFQUC5zcGxpbmVfbW9kZVxuICAgICMgICB1bmxlc3MgQGZyb20ua25vdCBvciBAdG8ua25vdFxuICAgICMgICAgIGRyYXdfZnJvbV90b19saW5lID0gZmFsc2VcblxuICAgIGlmIGRyYXdfZnJvbV90b19saW5lXG4gICAgICBjdHguYmVnaW5QYXRoKClcbiAgICAgIGN0eC5zdHJva2VTdHlsZSA9IEBjb2xvclxuICAgICAgY3R4LmxpbmVXaWR0aCA9IDFcbiAgICAgIGN0eC5tb3ZlVG8oQGZyb20ucG9zaXRpb24ueCwgQGZyb20ucG9zaXRpb24ueSlcbiAgICAgIGN0eC5saW5lVG8oQHRvLnBvc2l0aW9uLngsIEB0by5wb3NpdGlvbi55KVxuICAgICAgY3R4LnN0cm9rZSgpXG5cbiAgICBjdHguYmVnaW5QYXRoKClcbiAgICBpZiBBUFAuY3VydmUucGVuIGlzIHRoaXNcbiAgICAgIGN0eC5hcmMoQHBvc2l0aW9uLngsIEBwb3NpdGlvbi55LCBAcmFkaXVzICsgMywgMCwgVEFVKTtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSBAY29sb3JcbiAgICAgIGN0eC5maWxsKClcbiAgICAgIGN0eC5zdHJva2VTdHlsZSA9ICcjMDAwJ1xuICAgICAgY3R4LmxpbmVXaWR0aCA9IDJcbiAgICAgIGN0eC5nbG9iYWxPcGFjaXR5ID0gMC40XG4gICAgICBjdHguc3Ryb2tlKClcbiAgICAgIGN0eC5nbG9iYWxPcGFjaXR5ID0gMS4wXG4gICAgZWxzZVxuICAgICAgY3R4LmxpbmVXaWR0aCA9IDNcbiAgICAgIGN0eC5hcmMoQHBvc2l0aW9uLngsIEBwb3NpdGlvbi55LCBAcmFkaXVzICsgMSwgMCwgVEFVKTtcbiAgICAgIGN0eC5zdHJva2UoKVxuXG4gIHVwZGF0ZV9vcmRlcl8wX3BvaW50X2xhYmVsX2NvbG9yOiAtPlxuICAgIHJldHVybiB1bmxlc3MgQVBQLmN1cnZlP1xuXG4gICAgcmdiID0gQ29sb3IuaGV4MnJnYihAY29sb3IpO1xuICAgIGhzdiA9IENvbG9yLnJnYjJoc3YocmdiWzBdLCByZ2JbMV0sIHJnYlsyXSk7XG4gICAgaHN2WzBdICs9IDAuN1xuICAgIGhzdlswXSAtPSAxLjAgaWYgaHN2WzBdID4gMS4wXG4gICAgaHN2WzFdICo9IDAuNVxuICAgIGhzdlsyXSAqPSAwLjU1XG4gICAgcmdiID0gQ29sb3IuaHN2MnJnYihoc3ZbMF0sIGhzdlsxXSwgaHN2WzJdKTtcbiAgICBjb2xvciA9IENvbG9yLnJnYmFycjJoZXgocmdiKVxuXG4gICAgZm9yIHAgZnJvbSBBUFAuY3VydmUuZWFjaF9wb2ludCgpXG4gICAgICBwLmxhYmVsX2NvbG9yID0gY29sb3Jcblxud2luZG93LlVJIG9yPSB7fVxuY2xhc3MgVUkuT3B0aW9uXG4gIEBjcmVhdGVfaW5wdXRfZWxlbWVudDogKHR5cGUgPSBudWxsLCBpZCA9IG51bGwpID0+XG4gICAgZWwgPSB3aW5kb3cuQVBQLmNvbnRleHQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKVxuICAgIGVsLmlkID0gaWQgaWYgaWQ/XG4gICAgZWwudHlwZSA9IHR5cGUgaWYgdHlwZT9cbiAgICBlbFxuXG4gIGNvbnN0cnVjdG9yOiAoQGlkLCBkZWZhdWx0X3ZhbHVlID0gbnVsbCwgQGNhbGxiYWNrID0ge30pIC0+XG4gICAgaWYgQGlkIGluc3RhbmNlb2YgRWxlbWVudFxuICAgICAgQGlkID0gQGVsLmlkXG4gICAgZWxzZVxuICAgICAgQGVsID0gd2luZG93LkFQUC5jb250ZXh0LmdldEVsZW1lbnRCeUlkKEBpZClcbiAgICAgIHVubGVzcyBAZWw/XG4gICAgICAgIGNvbnNvbGUubG9nKFwiRVJST1IgLSBjb3VsZCBub3QgZmluZCBlbGVtZW50IHdpdGggaWQ9XFxcIiN7QGlkfVxcXCJcIilcblxuICAgIEBwZXJzaXN0ID0gdHJ1ZVxuICAgIEBzdG9yYWdlX2lkID0gXCJ1aV9vcHRpb24tI3tAaWR9XCJcbiAgICBAbGFiZWxfaWQgPSBcIiN7QGlkfV9sYWJlbFwiXG4gICAgQGxhYmVsX2VsID0gd2luZG93LkFQUC5jb250ZXh0LmdldEVsZW1lbnRCeUlkKEBsYWJlbF9pZClcblxuICAgIEBsYWJlbF90ZXh0X2Zvcm1hdGVyID0gQGRlZmF1bHRfbGFiZWxfdGV4dF9mb3JtYXRlclxuXG4gICAgaWYgZGVmYXVsdF92YWx1ZT9cbiAgICAgIEBkZWZhdWx0ID0gZGVmYXVsdF92YWx1ZVxuICAgIGVsc2VcbiAgICAgIEBkZWZhdWx0ID0gQGRldGVjdF9kZWZhdWx0X3ZhbHVlKClcblxuICAgIHN0b3JlZF92YWx1ZSA9IEFQUC5zdG9yYWdlX2dldChAc3RvcmFnZV9pZClcbiAgICBpZiBzdG9yZWRfdmFsdWU/XG4gICAgICBAc2V0KHN0b3JlZF92YWx1ZSlcbiAgICBlbHNlXG4gICAgICBAc2V0KEBkZWZhdWx0KVxuXG4gICAgQHNldHVwX2xpc3RlbmVycygpXG5cbiAgc2V0dXBfbGlzdGVuZXJzOiAtPlxuICAgIEBlbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBAb25fY2hhbmdlKVxuICAgIEBlbC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICBAb25faW5wdXQpXG5cbiAgZGV0ZWN0X2RlZmF1bHRfdmFsdWU6IC0+XG4gICAgQGdldCgpXG5cbiAgcmVzZXQ6IC0+XG4gICAgQVBQLnN0b3JhZ2VfcmVtb3ZlKEBzdG9yYWdlX2lkKVxuICAgIEBzZXQoQGRlZmF1bHQpXG5cbiAgcmVnaXN0ZXJfY2FsbGJhY2s6IChvcHQgPSB7fSkgLT5cbiAgICBmb3IgbmFtZSwgZnVuYyBvZiBvcHRcbiAgICAgIEBjYWxsYmFja1tuYW1lXSA9IGZ1bmNcblxuICAgIGZvciBrZXksIGZ1bmMgb2YgQGNhbGxiYWNrXG4gICAgICBkZWxldGUgQGNhbGxiYWNrW25hbWVdIHVubGVzcyBmdW5jP1xuXG4gIHNldF92YWx1ZTogKG5ld192YWx1ZSA9IG51bGwpIC0+XG4gICAgQHZhbHVlID0gbmV3X3ZhbHVlIGlmIG5ld192YWx1ZT9cbiAgICBAbGFiZWxfZWwuaW5uZXJUZXh0ID0gQGxhYmVsX3RleHQoKSBpZiBAbGFiZWxfZWw/XG5cbiAgICBpZiBAcGVyc2lzdFxuICAgICAgQVBQLnN0b3JhZ2Vfc2V0KEBzdG9yYWdlX2lkLCBAdmFsdWUsIEBkZWZhdWx0KVxuIFxuICBkZWZhdWx0X2xhYmVsX3RleHRfZm9ybWF0ZXI6ICh2YWx1ZSkgLT5cbiAgICBcIiN7dmFsdWV9XCJcblxuICBsYWJlbF90ZXh0OiAtPlxuICAgIEBsYWJlbF90ZXh0X2Zvcm1hdGVyKEB2YWx1ZSlcblxuICBzZXRfbGFiZWxfdGV4dF9mb3JtYXRlcjogKGZ1bmMpIC0+XG4gICAgQGxhYmVsX3RleHRfZm9ybWF0ZXIgPSBmdW5jXG4gICAgQHNldF92YWx1ZSgpXG5cbiAgb25fY2hhbmdlOiAoZXZlbnQpID0+IFxuICAgIEBzZXQoQGdldChldmVudC50YXJnZXQpLCBmYWxzZSlcbiAgICBAY2FsbGJhY2sub25fY2hhbmdlPyhAdmFsdWUpXG5cbiAgb25faW5wdXQ6IChldmVudCkgPT5cbiAgICBAc2V0KEBnZXQoZXZlbnQudGFyZ2V0KSwgZmFsc2UpXG4gICAgQGNhbGxiYWNrLm9uX2lucHV0PyhAdmFsdWUpXG5cbiAgZW5hYmxlOiAtPlxuICAgIEBlbC5kaXNhYmxlZCA9IGZhbHNlXG5cbiAgZGlzYWJsZTogLT5cbiAgICBAZWwuZGlzYWJsZWQgPSB0cnVlXG5cbiAgZGVzdHJveTogLT5cbiAgICBAZWwucmVtb3ZlKCkgaWYgQGVsP1xuICAgIEBlbCA9IG51bGxcblxuY2xhc3MgVUkuQm9vbE9wdGlvbiBleHRlbmRzIFVJLk9wdGlvblxuICBAY3JlYXRlOiAocGFyZW50LCBAaWQsIHJlc3QuLi4pIC0+XG4gICAgb3B0ID0gbmV3IFVJLkJvb2xPcHRpb24oVUlPcHRpb24uY3JlYXRlX2lucHV0X2VsZW1lbnQoJ2NoZWNrYm94JywgQGlkKSwgcmVzdC4uLilcbiAgICBwYXJlbnQuYXBwZW5kQ2hpbGQob3B0LmVsKVxuICAgIG9wdFxuXG4gIGNvbnN0cnVjdG9yOiAoYXJncy4uLikgLT5cbiAgICBzdXBlcihhcmdzLi4uKVxuXG4gICAgcGFyZW50ID0gQGVsLnBhcmVudEVsZW1lbnRcblxuICAgIEBvbl9lbCA9d2luZG93LkFQUC5jb250ZXh0LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKVxuICAgIEBvbl9lbC5pZCA9IFwiI3tAaWR9X29uXCJcbiAgICBAb25fZWwudGV4dENvbnRlbnQgPSBcIk9uXCJcbiAgICBAb25fZWwuY2xhc3NMaXN0LmFkZChcImJvb2xfb3B0aW9uX3N0YXRlXCIpXG4gICAgQG9uX2VsLmNsYXNzTGlzdC5hZGQoXCJvblwiKVxuICAgIEBvbl9lbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIEBvbl9ib29sX29wdGlvbl9zdGF0ZV9vbl9jbGljayk7XG4gICAgcGFyZW50LmFwcGVuZENoaWxkKEBvbl9lbClcblxuICAgIEBvZmZfZWwgPXdpbmRvdy5BUFAuY29udGV4dC5jcmVhdGVFbGVtZW50KCdzcGFuJylcbiAgICBAb2ZmX2VsLmlkID0gXCIje0BpZH1fb2ZmXCJcbiAgICBAb2ZmX2VsLnRleHRDb250ZW50ID0gXCJPZmZcIlxuICAgIEBvZmZfZWwuY2xhc3NMaXN0LmFkZChcImJvb2xfb3B0aW9uX3N0YXRlXCIpXG4gICAgQG9mZl9lbC5jbGFzc0xpc3QuYWRkKFwib2ZmXCIpXG4gICAgQG9mZl9lbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIEBvbl9ib29sX29wdGlvbl9zdGF0ZV9vZmZfY2xpY2spO1xuICAgIHBhcmVudC5hcHBlbmRDaGlsZChAb2ZmX2VsKVxuXG4gICAgQGVsLmNsYXNzTGlzdC5hZGQoXCJoaWRkZW5cIilcblxuICAgIEBzZXQoQGdldCgpKVxuXG4gIG9uX2Jvb2xfb3B0aW9uX3N0YXRlX29uX2NsaWNrOiA9PlxuICAgIEBzZXQoZmFsc2UpXG4gICAgQGNhbGxiYWNrLm9uX2NoYW5nZT8oQHZhbHVlKVxuXG4gIG9uX2Jvb2xfb3B0aW9uX3N0YXRlX29mZl9jbGljazogPT5cbiAgICBAc2V0KHRydWUpXG4gICAgQGNhbGxiYWNrLm9uX2NoYW5nZT8oQHZhbHVlKVxuXG4gIGdldDogKGVsZW1lbnQgPSBAZWwpIC0+XG4gICAgZWxlbWVudC5jaGVja2VkXG5cbiAgc2V0OiAoYm9vbF92YWx1ZSwgdXBkYXRlX2VsZW1lbnQgPSB0cnVlKSAtPlxuICAgIG9sZHZhbHVlID0gQHZhbHVlXG4gICAgbmV3dmFsdWUgPSBzd2l0Y2ggYm9vbF92YWx1ZVxuICAgICAgd2hlbiAndHJ1ZScgIHRoZW4gdHJ1ZVxuICAgICAgd2hlbiAnZmFsc2UnIHRoZW4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgISFib29sX3ZhbHVlXG4gICAgQGVsLmNoZWNrZWQgPSBuZXd2YWx1ZSBpZiB1cGRhdGVfZWxlbWVudFxuXG4gICAgQHNldF92YWx1ZShuZXd2YWx1ZSlcbiAgICBpZiBvbGR2YWx1ZSAhPSBuZXd2YWx1ZVxuICAgICAgaWYgbmV3dmFsdWVcbiAgICAgICAgQGNhbGxiYWNrLm9uX3RydWU/KClcbiAgICAgIGVsc2VcbiAgICAgICAgQGNhbGxiYWNrLm9uX2ZhbHNlPygpXG5cbiAgc2V0X3ZhbHVlOiAobmV3X3ZhbHVlID0gbnVsbCkgLT5cbiAgICBzdXBlcihuZXdfdmFsdWUpXG4gICAgQHVwZGF0ZV9vbl9vZmZfY2xhc3NlcygpXG5cbiAgdXBkYXRlX29uX29mZl9jbGFzc2VzOiAtPlxuICAgIGlmIEBnZXQoKVxuICAgICAgQG9uX2VsLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpIGlmIEBvbl9lbD9cbiAgICAgIEBvZmZfZWwuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJykgaWYgQG9mZl9lbD9cbiAgICBlbHNlXG4gICAgICBAb25fZWwuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJykgaWYgQG9uX2VsP1xuICAgICAgQG9mZl9lbC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKSBpZiBAb2ZmX2VsP1xuXG5jbGFzcyBVSS5JbnRPcHRpb24gZXh0ZW5kcyBVSS5PcHRpb25cbiAgQGNyZWF0ZTogKHBhcmVudCwgQGlkLCByZXN0Li4uKSAtPlxuICAgIG9wdCA9IG5ldyBVSS5JbnRPcHRpb24oVUlPcHRpb24uY3JlYXRlX2lucHV0X2VsZW1lbnQoJ251bWJlcicsIEBpZCksIHJlc3QuLi4pXG4gICAgcGFyZW50LmFwcGVuZENoaWxkKG9wdC5lbClcbiAgICBvcHRcblxuICBnZXQ6IChlbGVtZW50ID0gQGVsKSAtPlxuICAgIHBhcnNlSW50KGVsZW1lbnQudmFsdWUpXG5cbiAgc2V0OiAobnVtYmVyX3ZhbHVlLCB1cGRhdGVfZWxlbWVudCA9IHRydWUpIC0+XG4gICAgQHNldF92YWx1ZShwYXJzZUludChudW1iZXJfdmFsdWUpKVxuICAgIEBlbC52YWx1ZSA9IEB2YWx1ZSBpZiB1cGRhdGVfZWxlbWVudFxuXG5jbGFzcyBVSS5GbG9hdE9wdGlvbiBleHRlbmRzIFVJLk9wdGlvblxuICBAY3JlYXRlOiAocGFyZW50LCBAaWQsIHJlc3QuLi4pIC0+XG4gICAgb3B0ID0gbmV3IFVJLkludE9wdGlvbihVSU9wdGlvbi5jcmVhdGVfaW5wdXRfZWxlbWVudChudWxsLCBAaWQpLCByZXN0Li4uKVxuICAgIHBhcmVudC5hcHBlbmRDaGlsZChvcHQuZWwpXG4gICAgb3B0XG5cbiAgZ2V0OiAoZWxlbWVudCA9IEBlbCkgLT5cbiAgICBwYXJzZUZsb2F0KGVsZW1lbnQudmFsdWUpXG5cbiAgc2V0OiAobnVtYmVyX3ZhbHVlLCB1cGRhdGVfZWxlbWVudCA9IHRydWUpIC0+XG4gICAgQHNldF92YWx1ZShwYXJzZUZsb2F0KG51bWJlcl92YWx1ZSkpXG4gICAgQGVsLnZhbHVlID0gQHZhbHVlIGlmIHVwZGF0ZV9lbGVtZW50XG5cbmNsYXNzIFVJLlBlcmNlbnRPcHRpb24gZXh0ZW5kcyBVSS5GbG9hdE9wdGlvblxuICBsYWJlbF90ZXh0OiAtPlxuICAgIHBlcmMgPSBwYXJzZUludChAdmFsdWUgKiAxMDApXG4gICAgXCIje3BlcmN9JVwiXG5cbmNsYXNzIFVJLlNlbGVjdE9wdGlvbiBleHRlbmRzIFVJLk9wdGlvblxuICBzZXR1cF9saXN0ZW5lcnM6IC0+XG4gICAgQGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIEBvbl9jaGFuZ2UpXG4gICAgIyBza2lwIGlucHV0IGV2ZW50XG5cbiAgZ2V0OiAoZWxlbWVudCA9IEBlbCkgLT5cbiAgICBvcHQgPSBlbGVtZW50Lm9wdGlvbnNbZWxlbWVudC5zZWxlY3RlZEluZGV4XVxuICAgIGlmIG9wdD9cbiAgICAgIG9wdC52YWx1ZVxuICAgIGVsc2VcbiAgICAgIG51bGxcblxuICBzZXQ6IChvcHRpb25fbmFtZSwgdXBkYXRlX2VsZW1lbnQgPSB0cnVlKSAtPlxuICAgIG9wdCA9IEBvcHRpb25fd2l0aF9uYW1lKG9wdGlvbl9uYW1lKVxuICAgIGlmIG9wdD9cbiAgICAgIEBzZXRfdmFsdWUob3B0LnZhbHVlKVxuICAgICAgb3B0LnNlbGVjdGVkID0gdHJ1ZSBpZiB1cGRhdGVfZWxlbWVudFxuXG4gIHZhbHVlczogLT5cbiAgICBAZWwub3B0aW9ucy5tYXAoICh4KSAtPiB4Lm5hbWUgKVxuXG4gIG9wdGlvbl93aXRoX25hbWU6IChuYW1lKSAtPlxuICAgIGZvciBvcHQgaW4gQGVsLm9wdGlvbnNcbiAgICAgIGlmIG9wdC52YWx1ZSBpcyBuYW1lXG4gICAgICAgIHJldHVybiBvcHRcbiAgICByZXR1cm4gbnVsbFxuXG4gIGFkZF9vcHRpb246ICh2YWx1ZSwgdGV4dCwgc2VsZWN0ZWQ9ZmFsc2UpIC0+XG4gICAgb3B0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb3B0aW9uJylcbiAgICBvcHQudmFsdWUgPSB2YWx1ZVxuICAgIG9wdC50ZXh0ID0gdGV4dFxuICAgIEBlbC5hZGQob3B0LCBudWxsKVxuICAgIG9wdC5zZWxlY3RlZCA9IHRydWUgaWYgc2VsZWN0ZWRcbiAgICBAc2V0KEBnZXQoKSlcblxuY2xhc3MgVUkuQ2hvaWNlT3B0aW9uIGV4dGVuZHMgVUkuT3B0aW9uXG4gIGNvbnN0cnVjdG9yOiAoQGdyb3VwX2NsYXNzLCBkZWZhdWx0X3ZhbHVlID0gbnVsbCwgQGNhbGxiYWNrID0ge30pIC0+XG4gICAgQGdyb3VwX3NlbGVjdG9yID0gXCIuI3tAZ3JvdXBfY2xhc3N9XCJcbiAgICBAZWxfbGlzdCA9IHdpbmRvdy5BUFAuY29udGV4dC5xdWVyeVNlbGVjdG9yQWxsKEBncm91cF9zZWxlY3RvcilcbiAgICB1bmxlc3MgQGVsX2xpc3Q/Lmxlbmd0aCA+IDBcbiAgICAgICAgY29uc29sZS5sb2coXCJFUlJPUiAtIGNvdWxkIG5vdCBmaW5kIHdpdGggY2xhc3MgXFxcIiN7QG5hbWV9XFxcIlwiKVxuXG4gICAgQHBlcnNpc3QgPSB0cnVlXG4gICAgQHN0b3JhZ2VfaWQgPSBcInVpX29wdGlvbi0je0Bncm91cF9jbGFzc31cIlxuXG4gICAgQGVsX2xpc3QuZm9yRWFjaChAc2V0dXBfY2hvaWNlKVxuXG4gICAgaWYgZGVmYXVsdF92YWx1ZT9cbiAgICAgIEBkZWZhdWx0ID0gZGVmYXVsdF92YWx1ZVxuICAgIGVsc2VcbiAgICAgIEBkZWZhdWx0ID0gQGRldGVjdF9kZWZhdWx0X3ZhbHVlKClcblxuICAgIHN0b3JlZF92YWx1ZSA9IEFQUC5zdG9yYWdlX2dldChAc3RvcmFnZV9pZClcbiAgICBpZiBzdG9yZWRfdmFsdWU/XG4gICAgICBAc2V0KHN0b3JlZF92YWx1ZSlcbiAgICBlbHNlXG4gICAgICBAc2V0KEBkZWZhdWx0KVxuXG4gIGRldGVjdF9kZWZhdWx0X3ZhbHVlOiAtPlxuICAgIEBlbF9saXN0WzBdLmRhdGFzZXQudmFsdWVcblxuICBzZXR1cF9jaG9pY2U6IChlbCkgPT5cbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIEBvbl9jaG9pY2VfY2xpY2spO1xuXG4gIG9uX2Nob2ljZV9jbGljazogKGV2ZW50KSA9PlxuICAgIEBzZXQoZXZlbnQudGFyZ2V0LmRhdGFzZXQudmFsdWUpXG5cbiAgc2V0dXBfbGlzdGVuZXJzOiAtPlxuXG4gIHNldF92YWx1ZTogKG5ld192YWx1ZSA9IG51bGwpIC0+XG4gICAgaWYgbmV3X3ZhbHVlP1xuICAgICAgb2xkX3ZhbHVlID0gQHZhbHVlXG4gICAgICBAdmFsdWUgPSBuZXdfdmFsdWVcbiAgICAgIGlmIG9sZF92YWx1ZSAhPSBuZXdfdmFsdWVcbiAgICAgICAgQGNhbGxiYWNrLm9uX2NoYW5nZT8oQHZhbHVlKVxuICAgIGVsc2VcbiAgICAgIGNvbnNvbGUubG9nKFwic2V0X3ZhbHVlKG51bGwpIGNhbGxlZCBmb3IgVUkuQ2hvaWNlT3B0aW9uIFxcXCIje0Bncm91cF9jbGFzc31cXCdcIilcblxuICAgIGlmIEBwZXJzaXN0XG4gICAgICBBUFAuc3RvcmFnZV9zZXQoQHN0b3JhZ2VfaWQsIEB2YWx1ZSwgQGRlZmF1bHQpXG5cbiAgZ2V0X2VsZW1lbnRfd2l0aF92YWx1ZTogKHZhbHVlKSAtPlxuICAgIGZvciBlbCBpbiBAZWxfbGlzdFxuICAgICAgaWYgZWwuZGF0YXNldC52YWx1ZSA9PSB2YWx1ZVxuICAgICAgICByZXR1cm4gZWxcbiAgICByZXR1cm4gbnVsbFxuXG4gIGNsZWFyX3NlbGVjdGVkOiAtPlxuICAgIGZvciBlbCBpbiBAZWxfbGlzdFxuICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnc2VsZWN0ZWQnKVxuXG4gIGdldDogLT5cbiAgICBAdmFsdWVcblxuICBzZXQ6IChuZXdfdmFsdWUsIHVwZGF0ZV9lbGVtZW50ID0gdHJ1ZSkgLT5cbiAgICBlbCA9IEBnZXRfZWxlbWVudF93aXRoX3ZhbHVlKG5ld192YWx1ZSlcbiAgICBpZiBlbD9cbiAgICAgIEBzZXRfdmFsdWUobmV3X3ZhbHVlKVxuICAgICAgaWYgdXBkYXRlX2VsZW1lbnRcbiAgICAgICAgQGNsZWFyX3NlbGVjdGVkKClcbiAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKVxuICAgIGVsc2VcbiAgICAgIGNvbnNvbGUubG9nKFwiSW52YWxpZCB2YWx1ZSBcXFwiI3tuZXdfdmFsdWV9XFxcIiBmb3IgVUkuQ2hvaWNlT3B0aW9uIFxcXCIje0Bncm91cF9jbGFzc31cXCdcIilcblxuICBjaGFuZ2U6IC0+XG4gICAgQGNhbGxiYWNrLm9uX2NoYW5nZT8oQHZhbHVlKVxuXG4gIGVuYWJsZTogLT5cbiAgICBAZWxfbGlzdC5mb3JFYWNoKCAoZWwpIC0+IGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2Rpc2FibGVkJykgKVxuXG4gIGRpc2FibGU6IC0+XG4gICAgQGVsX2xpc3QuZm9yRWFjaCggKGVsKSAtPiBlbC5jbGFzc0xpc3QuYWRkKCdkaXNhYmxlZCcpIClcblxuY2xhc3MgVUkuQ29sb3JPcHRpb24gZXh0ZW5kcyBVSS5PcHRpb25cbiAgZ2V0OiAoZWxlbWVudCA9IEBlbCkgLT5cbiAgICBlbGVtZW50LnZhbHVlXG5cbiAgc2V0OiAobmV3X3ZhbHVlLCB1cGRhdGVfZWxlbWVudCA9IHRydWUpIC0+XG4gICAgQHNldF92YWx1ZShuZXdfdmFsdWUpXG4gICAgQGVsLnZhbHVlID0gbmV3X3ZhbHVlIGlmIHVwZGF0ZV9lbGVtZW50XG4gICAgQGNvbG9yXG4iXX0=
//# sourceURL=coffeescript
