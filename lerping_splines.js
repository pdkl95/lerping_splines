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
