(function() {
  var APP, LERP, LERPingSplines, Point, TAU, Vec2,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  APP = null;

  TAU = 2 * Math.PI;

  Vec2 = (function() {
    function Vec2() {}

    Vec2.lerp = function(a, b, amount) {
      return {
        x: a.x + (amount * (b.x - a.x)),
        y: a.y + (amount * (b.y - a.y))
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

    return Vec2;

  })();

  Point = (function() {
    function Point(x, y, color) {
      this.color = color;
      this.enabled = false;
      this.hover = false;
      this.selected = false;
      this.order = 0;
      this.radius = 5;
      if (this.color == null) {
        this.color = '#000';
      }
      this.position = {
        x: x,
        y: y
      };
      this.move(x, y);
    }

    Point.prototype.move = function(x, y) {
      this.x = x;
      this.y = y;
      this.ix = Math.floor(this.x);
      return this.iy = Math.floor(this.y);
    };

    Point.prototype.contains = function(x, y) {
      var dist, dx, dy;
      dx = this.x - x;
      dy = this.y - y;
      dist = Math.sqrt((dx * dx) + (dy * dy));
      return dist <= this.radius;
    };

    Point.prototype.update = function(t) {
      this.position.x = this.x;
      return this.position.y = this.y;
    };

    Point.prototype.draw = function() {
      var ctx;
      if (!this.enabled) {
        return;
      }
      ctx = APP.graph_ctx;
      if (this.hover) {
        ctx.beginPath();
        ctx.fillStyle = '#ff0';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.arc(this.x, this.y, this.radius * 3, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.fillStyle = this.color;
      ctx.arc(this.x, this.y, this.radius, 0, TAU);
      return ctx.fill();
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
            return '#000';
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
      console.log("lerp<" + this.order + "> color", this.color);
      this.position = {
        x: this.from.x,
        y: this.from.y
      };
      this.prev_position = {
        x: null,
        y: null
      };
    }

    LERP.prototype.interpolate = function(t, a, b) {
      return (t * a) + ((1 - t) * b);
    };

    LERP.prototype.update = function(t) {
      this.enabled = this.from.enabled && this.to.enabled;
      this.position.x = this.interpolate(t, this.from.position.x, this.to.position.x);
      return this.position.y = this.interpolate(t, this.from.position.y, this.to.position.y);
    };

    LERP.prototype.draw = function() {
      var ctx;
      if (!this.enabled) {
        return;
      }
      ctx = APP.graph_ctx;
      ctx.beginPath();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.moveTo(this.from.position.x, this.from.position.y);
      ctx.lineTo(this.to.position.x, this.to.position.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.arc(this.position.x, this.position.y, this.radius + 1, 0, TAU);
      return ctx.stroke();
    };

    return LERP;

  })(Point);

  LERPingSplines = (function() {
    LERPingSplines.min_points = 2;

    LERPingSplines.max_points = 8;

    LERPingSplines.max_lerp_order = function() {
      return LERPingSplines.max_points - 1;
    };

    LERPingSplines.create_point_margin = 0.12;

    function LERPingSplines(context) {
      this.context = context;
      this.schedule_first_frame = bind(this.schedule_first_frame, this);
      this.first_update_callback = bind(this.first_update_callback, this);
      this.schedule_next_frame = bind(this.schedule_next_frame, this);
      this.update_callback = bind(this.update_callback, this);
      this.update = bind(this.update, this);
      this.update_at = bind(this.update_at, this);
      this.redraw_ui = bind(this.redraw_ui, this);
      this.on_mouseup = bind(this.on_mouseup, this);
      this.on_mousedown = bind(this.on_mousedown, this);
      this.on_mousemove = bind(this.on_mousemove, this);
      this.stop = bind(this.stop, this);
      this.start = bind(this.start, this);
      this.on_tslider_stop = bind(this.on_tslider_stop, this);
      this.on_tslider_start = bind(this.on_tslider_start, this);
      this.on_tslide_btn_max_click = bind(this.on_tslide_btn_max_click, this);
      this.on_tslide_btn_min_click = bind(this.on_tslide_btn_min_click, this);
      this.on_tslider_changer = bind(this.on_tslider_changer, this);
      this.on_tslider_slide = bind(this.on_tslider_slide, this);
      this.on_btn_run_change = bind(this.on_btn_run_change, this);
      this.on_remove_point_btn_click = bind(this.on_remove_point_btn_click, this);
      this.on_add_point_btn_click = bind(this.on_add_point_btn_click, this);
    }

    LERPingSplines.prototype.init = function() {
      console.log('Starting init()...');
      this.running = false;
      this.content_el = this.context.getElementById('content');
      this.graph_wrapper = this.context.getElementById('graph_wrapper');
      this.graph_canvas = this.context.getElementById('graph');
      this.graph_ctx = this.graph_canvas.getContext('2d', {
        alpha: true
      });
      this.graph_width = this.graph_canvas.width;
      this.graph_height = this.graph_canvas.height;
      this.points = [];
      this.enabled_points = 0;
      this.btn_run = $('#button_run').checkboxradio({
        icon: false
      });
      this.btn_run.change(this.on_btn_run_change);
      this.num_points = $('#num_points');
      this.add_point_btn = $('#add_point').button({
        icon: 'ui-icon-plusthick',
        showLabel: false
      });
      this.add_point_btn.click(this.on_add_point_btn_click);
      this.remove_point_btn = $('#remove_point').button({
        icon: 'ui-icon-minusthick',
        showLabel: false
      });
      this.remove_point_btn.click(this.on_remove_point_btn_click);
      this.tvar = $('#tvar');
      this.tslider_btn_min = $('#tbox_slider_btn_min').button({
        showLabel: false,
        icon: 'ui-icon-arrowthickstop-1-w',
        click: this.on_tslide_btn_min_click
      });
      this.tslider_btn_min.click(this.on_tslide_btn_min_click);
      this.tslider_btn_max = $('#tbox_slider_btn_max').button({
        showLabel: false,
        icon: 'ui-icon-arrowthickstop-1-e'
      });
      this.tslider_btn_max.click(this.on_tslide_btn_max_click);
      this.tslider_saved_running_status = this.running;
      this.tslider = $('#tbox_slider').slider({
        min: 0.0,
        max: 1.0,
        step: 0.01,
        change: this.on_tslider_change,
        slide: this.on_tslider_slide,
        stop: this.on_tslider_stop
      });
      this.context.addEventListener('mousemove', this.on_mousemove);
      this.context.addEventListener('mousedown', this.on_mousedown);
      this.context.addEventListener('mouseup', this.on_mouseup);
      console.log('init() completed!');
      this.reset_loop();
      this.add_initial_points();
      return this.update();
    };

    LERPingSplines.prototype.debug = function(msg_text) {
      var hdr, line, msg, timestamp;
      if (this.debugbox == null) {
        this.debugbox = $('#debugbox');
        this.debugbox.removeClass('hidden');
      }
      hdr = $('<span/>', {
        "class": 'hdr'
      });
      msg = $('<span/>', {
        "class": 'msg'
      });
      timestamp = new Date();
      hdr.text(timestamp.toISOString());
      msg.text('' + msg_text);
      line = $('<div/>', {
        "class": "dbg_line"
      }).append([hdr, msg]);
      this.debugbox.append(line);
      return this.debugbox.animate({
        scrollTop: this.debugbox.prop("scrollHeight")
      }, 600);
    };

    LERPingSplines.prototype.reset_loop = function() {
      this.t = 0;
      return this.t_step = 0.002;
    };

    LERPingSplines.prototype.loop_start = function() {
      return this.loop_running = true;
    };

    LERPingSplines.prototype.loop_stop = function() {
      return this.loop_running = false;
    };

    LERPingSplines.prototype.add_initial_points = function() {
      var i, j, k, l, lerp, m, margin, order, prev, prev_order, range, ref, ref1, ref2, x, y;
      margin = LERPingSplines.create_point_margin;
      range = 1.0 - (2.0 * margin);
      this.points[0] = [];
      for (i = k = 0, ref = LERPingSplines.max_points; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
        x = margin + (range * Math.random());
        y = margin + (range * Math.random());
        this.points[0][i] = new Point(x * this.graph_width, y * this.graph_height);
      }
      for (order = l = 1, ref1 = LERPingSplines.max_points; 1 <= ref1 ? l <= ref1 : l >= ref1; order = 1 <= ref1 ? ++l : --l) {
        this.points[order] = [];
        prev_order = order - 1;
        prev = this.points[prev_order];
        for (j = m = 0, ref2 = LERPingSplines.max_points - order; 0 <= ref2 ? m <= ref2 : m >= ref2; j = 0 <= ref2 ? ++m : --m) {
          lerp = new LERP(order, prev[j], prev[j + 1]);
          this.points[order][j] = lerp;
        }
      }
      this.enable_point_at(0.88, 0.90);
      this.enable_point_at(0.72, 0.18);
      this.enable_point_at(0.15, 0.08);
      this.enable_point_at(0.06, 0.85);
      this.update_enabled_points();
      return console.log('Initial points created!');
    };

    LERPingSplines.prototype.find_point = function(x, y) {
      var k, len, p, ref;
      ref = this.points[0];
      for (k = 0, len = ref.length; k < len; k++) {
        p = ref[k];
        if (p != null ? p.contains(x, y) : void 0) {
          return p;
        }
      }
      return null;
    };

    LERPingSplines.prototype.update_enabled_points = function() {
      if (this.enabled_points < LERPingSplines.max_points) {
        this.add_point_btn.button("enable");
      } else {
        this.add_point_btn.button("disable");
      }
      if (this.enabled_points > LERPingSplines.min_points) {
        this.remove_point_btn.button("enable");
      } else {
        this.remove_point_btn.button("disable");
      }
      this.num_points.text("" + this.enabled_points);
      return this.update();
    };

    LERPingSplines.prototype.enable_point = function() {
      var p;
      if (this.enabled_points >= LERPingSplines.max_points) {
        return;
      }
      p = this.points[0][this.enabled_points];
      this.enabled_points += 1;
      p.enabled = true;
      this.update_enabled_points();
      return p;
    };

    LERPingSplines.prototype.enable_point_at = function(x, y) {
      var p;
      p = this.enable_point();
      p.x = x * this.graph_width;
      p.y = y * this.graph_height;
      return p;
    };

    LERPingSplines.prototype.disable_point = function() {
      var p;
      if (this.enabled_points <= LERPingSplines.min_points) {
        return;
      }
      this.enabled_points -= 1;
      p = this.points[0][this.enabled_points];
      p.enabled = false;
      this.update_enabled_points();
      return p;
    };

    LERPingSplines.prototype.on_add_point_btn_click = function(event, ui) {
      this.enable_point();
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_remove_point_btn_click = function(event, ui) {
      this.disable_point();
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_btn_run_change = function(event, ui) {
      var checked;
      checked = this.btn_run.is(':checked');
      if (checked) {
        return this.start();
      } else {
        return this.stop();
      }
    };

    LERPingSplines.prototype.on_tslider_slide = function(event, ui) {
      var v;
      v = this.tslider.slider("option", "value");
      this.set_t(v);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_tslider_changer = function(event, ui) {
      this.on_tslider_slide(event, ui);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_tslide_btn_min_click = function() {
      this.set_t(0.0);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_tslide_btn_max_click = function() {
      this.set_t(1.0);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_tslider_start = function() {
      return console.log('tslider start');
    };

    LERPingSplines.prototype.on_tslider_stop = function() {
      console.log('tslider stop');
      this.update_and_draw();
      if (this.running) {
        return this.start();
      }
    };

    LERPingSplines.prototype.set_t = function(value) {
      this.t = value;
      while (this.t > 1.0) {
        this.t -= 1.0;
      }
      this.tvar.text(this.t.toFixed(2));
      return this.tslider.slider("option", "value", this.t);
    };

    LERPingSplines.prototype.start = function() {
      console.log('start()');
      if (this.running) {

      } else {
        this.running = true;
        return this.schedule_first_frame();
      }
    };

    LERPingSplines.prototype.stop = function() {
      console.log('stop()');
      return this.running = false;
    };

    LERPingSplines.prototype.get_mouse_coord = function(event) {
      var cc;
      cc = this.graph_canvas.getBoundingClientRect();
      return {
        x: event.pageX - cc.left,
        y: event.pageY - cc.top
      };
    };

    LERPingSplines.prototype.on_mousemove = function(event) {
      var k, len, mouse, oldhover, oldx, oldy, order, p, ref, results;
      mouse = this.get_mouse_coord(event);
      ref = this.points;
      results = [];
      for (k = 0, len = ref.length; k < len; k++) {
        order = ref[k];
        results.push((function() {
          var l, len1, results1;
          results1 = [];
          for (l = 0, len1 = order.length; l < len1; l++) {
            p = order[l];
            oldx = p.x;
            oldy = p.y;
            if (p.selected) {
              p.x = mouse.x;
              p.y = mouse.y;
            }
            oldhover = p.hover;
            if (p.contains(mouse.x, mouse.y)) {
              p.hover = true;
            } else {
              p.hover = false;
            }
            if ((p.hover !== oldhover) || (p.x !== oldx) || (p.y !== oldy)) {
              results1.push(this.update_and_draw());
            } else {
              results1.push(void 0);
            }
          }
          return results1;
        }).call(this));
      }
      return results;
    };

    LERPingSplines.prototype.on_mousedown = function(event) {
      var mouse, p;
      mouse = this.get_mouse_coord(event);
      p = this.find_point(mouse.x, mouse.y);
      if (p != null) {
        return p.selected = true;
      }
    };

    LERPingSplines.prototype.on_mouseup = function(event) {
      var k, len, order, p, ref, results;
      ref = this.points;
      results = [];
      for (k = 0, len = ref.length; k < len; k++) {
        order = ref[k];
        results.push((function() {
          var l, len1, results1;
          results1 = [];
          for (l = 0, len1 = order.length; l < len1; l++) {
            p = order[l];
            results1.push(p.selected = false);
          }
          return results1;
        })());
      }
      return results;
    };

    LERPingSplines.prototype.redraw_ui = function(render_bitmap_preview) {
      var k, l, len, len1, order, p, ref, ref1;
      if (render_bitmap_preview == null) {
        render_bitmap_preview = true;
      }
      this.graph_ui_ctx.clearRect(0, 0, this.graph_ui_canvas.width, this.graph_ui_canvas.height);
      if ((ref = this.cur) != null) {
        ref.draw_ui();
      }
      ref1 = this.points;
      for (k = 0, len = ref1.length; k < len; k++) {
        order = ref1[k];
        for (l = 0, len1 = order.length; l < len1; l++) {
          p = order[l];
          p.draw_ui();
        }
      }
      return null;
    };

    LERPingSplines.prototype.update_at = function(t) {
      var k, len, order, p, ref, results;
      ref = this.points;
      results = [];
      for (k = 0, len = ref.length; k < len; k++) {
        order = ref[k];
        results.push((function() {
          var l, len1, results1;
          results1 = [];
          for (l = 0, len1 = order.length; l < len1; l++) {
            p = order[l];
            results1.push(p.update(t));
          }
          return results1;
        })());
      }
      return results;
    };

    LERPingSplines.prototype.update = function() {
      return this.update_at(this.t);
    };

    LERPingSplines.prototype.draw_bezier = function() {
      var ctx, i, k, p, ref, start, t;
      start = this.points[0][0];
      p = null;
      for (i = k = ref = LERPingSplines.max_points - 1; ref <= 1 ? k <= 1 : k >= 1; i = ref <= 1 ? ++k : --k) {
        p = this.points[i][0];
        if (p != null ? p.enabled : void 0) {
          break;
        }
      }
      ctx = this.graph_ctx;
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
      ctx.stroke();
      return this.pen = p;
    };

    LERPingSplines.prototype.draw = function() {
      var k, l, len, len1, len2, len3, m, n, order, p, ref, ref1, ref2, results;
      ref = this.points;
      for (k = 0, len = ref.length; k < len; k++) {
        order = ref[k];
        for (l = 0, len1 = order.length; l < len1; l++) {
          p = order[l];
          if (p.order > 1) {
            p.draw();
          }
        }
      }
      ref1 = this.points[1];
      for (m = 0, len2 = ref1.length; m < len2; m++) {
        p = ref1[m];
        p.draw();
      }
      ref2 = this.points[0];
      results = [];
      for (n = 0, len3 = ref2.length; n < len3; n++) {
        p = ref2[n];
        results.push(p.draw());
      }
      return results;
    };

    LERPingSplines.prototype.draw_pen = function() {
      var angle, arrow, arrow1, arrow2, arrowtip, ctx, normal;
      if (this.pen == null) {
        return;
      }
      if ((this.pen.prev_position.x != null) && (this.pen.prev_position.y != null)) {
        normal = {
          x: -(this.pen.position.y - this.pen.prev_position.y),
          y: this.pen.position.x - this.pen.prev_position.x
        };
        arrow = Vec2.scale(normal, 8.0);
        arrowtip = Vec2.scale(normal, 7.0);
        normal = Vec2.scale(normal, 30.0);
        angle = TAU / 8.0;
        arrow1 = Vec2.rotate(arrow, angle);
        arrow2 = Vec2.rotate(arrow, -angle);
        arrowtip.x += this.pen.position.x;
        arrowtip.y += this.pen.position.y;
        ctx = this.graph_ctx;
        ctx.beginPath();
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + normal.x, arrowtip.y + normal.y);
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow1.x, arrowtip.y + arrow1.y);
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow2.x, arrowtip.y + arrow2.y);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      this.pen.prev_position.x = this.pen.position.x;
      return this.pen.prev_position.y = this.pen.position.y;
    };

    LERPingSplines.prototype.update_and_draw = function() {
      this.graph_ctx.clearRect(0, 0, this.graph_canvas.width, this.graph_canvas.height);
      this.draw_bezier();
      this.update();
      this.draw();
      return this.draw_pen();
    };

    LERPingSplines.prototype.update_callback = function(timestamp) {
      var elapsed;
      this.frame_is_scheduled = false;
      elapsed = timestamp - this.prev_anim_timestamp;
      if (elapsed > 0) {
        this.prev_anim_timestamp = this.anim_timestamp;
        this.set_t(this.t + this.t_step);
        this.update_and_draw();
      }
      if (this.running) {
        this.schedule_next_frame();
      }
      return null;
    };

    LERPingSplines.prototype.schedule_next_frame = function() {
      if (!this.frame_is_scheduled) {
        this.frame_is_scheduled = true;
        window.requestAnimationFrame(this.update_callback);
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
      this.frame_is_scheduled = true;
      window.requestAnimationFrame(this.first_update_callback);
      return null;
    };

    return LERPingSplines;

  })();

  $(document).ready((function(_this) {
    return function() {
      APP = new LERPingSplines(document);
      APP.init();
      return APP.draw();
    };
  })(this));

}).call(this);
