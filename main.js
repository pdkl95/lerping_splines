(function() {
  var APP, LERP, LERPingSplines, Point, TAU,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  APP = null;

  TAU = 2 * Math.PI;

  Point = (function() {
    function Point(x, y, color) {
      this.color = color;
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

    function LERP(from1, to1) {
      var color_fract;
      this.from = from1;
      this.to = to1;
      this.order = this.from.order + 1;
      this.radius = 5;
      color_fract = this.order / (APP.max_lerp_order + 2);
      color_fract *= 255;
      this.color = "rgb(" + color_fract + "," + color_fract + "," + color_fract + ")";
      this.position = {
        x: this.from.x,
        y: this.from.y
      };
    }

    LERP.prototype.interpolate = function(t, a, b) {
      return (t * a) + ((1 - t) * b);
    };

    LERP.prototype.update = function(t) {
      this.position.x = this.interpolate(t, this.from.position.x, this.to.position.x);
      return this.position.y = this.interpolate(t, this.from.position.y, this.to.position.y);
    };

    LERP.prototype.draw = function() {
      var ctx;
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
    function LERPingSplines(context) {
      this.context = context;
      this.schedule_first_frame = bind(this.schedule_first_frame, this);
      this.first_update_callback = bind(this.first_update_callback, this);
      this.schedule_next_frame = bind(this.schedule_next_frame, this);
      this.update_callback = bind(this.update_callback, this);
      this.update = bind(this.update, this);
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
      this.on_num_points_changed = bind(this.on_num_points_changed, this);
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
      this.set_max_lerp_order(3);
      this.btn_run = $('#button_run').checkboxradio({
        icon: false
      });
      this.btn_run.change(this.on_btn_run_change);
      this.num_points = $('#num_points').spinner({
        change: this.on_num_points_changed,
        stop: this.on_num_points_changed
      });
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

    LERPingSplines.prototype.debug = function(msg) {
      var timestamp;
      if (this.debugbox == null) {
        this.debugbox = $('#debugbox');
        this.debugbox_hdr = this.debugbox.find('.hdr');
        this.debugbox_msg = this.debugbox.find('.msg');
        this.debugbox.removeClass('hidden');
      }
      timestamp = new Date();
      this.debugbox_hdr.text(timestamp.toISOString());
      return this.debugbox_msg.text('' + msg);
    };

    LERPingSplines.prototype.set_max_lerp_order = function(n) {
      var base, i, j, ref, results;
      this.max_lerp_order = n;
      results = [];
      for (i = j = 0, ref = n; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        results.push((base = this.points)[i] || (base[i] = []));
      }
      return results;
    };

    LERPingSplines.prototype.reset_loop = function() {
      this.t = 0;
      return this.t_step = 0.01;
    };

    LERPingSplines.prototype.loop_start = function() {
      return this.loop_running = true;
    };

    LERPingSplines.prototype.loop_stop = function() {
      return this.loop_running = false;
    };

    LERPingSplines.prototype.add_initial_points = function() {
      this.add_point(0.88 * this.graph_width, 0.90 * this.graph_height);
      this.add_point(0.72 * this.graph_width, 0.18 * this.graph_height);
      this.add_point(0.15 * this.graph_width, 0.08 * this.graph_height);
      this.add_point(0.06 * this.graph_width, 0.85 * this.graph_height);
      return console.log('Initial points created!');
    };

    LERPingSplines.prototype.add_lerp = function(from, to) {
      var lerp;
      lerp = new LERP(from, to);
      return this.points[lerp.order].push(lerp);
    };

    LERPingSplines.prototype.remove_lerp = function(order) {
      return this.points[order].pop();
    };

    LERPingSplines.prototype.fix_num_lerps = function() {
      var i, j, pi, plen, prev, ref, results, target;
      results = [];
      for (i = j = 1, ref = this.max_lerp_order; 1 <= ref ? j <= ref : j >= ref; i = 1 <= ref ? ++j : --j) {
        pi = i - 1;
        prev = this.points[pi];
        plen = prev.length;
        target = plen - 1;
        results.push((function() {
          var results1;
          results1 = [];
          while (this.points[i].length < target) {
            prev = this.points[pi];
            plen = prev.length;
            if (!(plen < 2)) {
              results1.push(this.add_lerp(prev[plen - 2], prev[plen - 1]));
            } else {
              results1.push(void 0);
            }
          }
          return results1;
        }).call(this));
      }
      return results;
    };

    LERPingSplines.prototype.find_point = function(x, y) {
      var j, k, len, len1, order, p, ref;
      ref = this.points;
      for (j = 0, len = ref.length; j < len; j++) {
        order = ref[j];
        for (k = 0, len1 = order.length; k < len1; k++) {
          p = order[k];
          if (p.contains(x, y)) {
            return p;
          }
        }
      }
      return null;
    };

    LERPingSplines.prototype.add_point = function(x, y) {
      var p;
      p = new Point(x, y);
      this.points[0].push(p);
      return this.fix_num_lerps();
    };

    LERPingSplines.prototype.remove_point = function() {
      this.remove_lerp(0);
      return this.fix_num_lerps();
    };

    LERPingSplines.prototype.set_num_points = function(target_num) {
      var results;
      while (this.points.length < target_num) {
        this.add_point();
      }
      results = [];
      while (this.points.length > target_num) {
        results.push(this.remove_point());
      }
      return results;
    };

    LERPingSplines.prototype.on_num_points_changed = function(event, ui) {
      var msg;
      msg = '[num_points] event: ' + event.type + ', value = ' + this.num_points.val();
      return this.debug(msg);
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
      var j, len, mouse, oldhover, oldx, oldy, order, p, ref, results;
      mouse = this.get_mouse_coord(event);
      ref = this.points;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        order = ref[j];
        results.push((function() {
          var k, len1, results1;
          results1 = [];
          for (k = 0, len1 = order.length; k < len1; k++) {
            p = order[k];
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
      var j, len, order, p, ref, results;
      ref = this.points;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        order = ref[j];
        results.push((function() {
          var k, len1, results1;
          results1 = [];
          for (k = 0, len1 = order.length; k < len1; k++) {
            p = order[k];
            results1.push(p.selected = false);
          }
          return results1;
        })());
      }
      return results;
    };

    LERPingSplines.prototype.redraw_ui = function(render_bitmap_preview) {
      var j, k, len, len1, order, p, ref, ref1;
      if (render_bitmap_preview == null) {
        render_bitmap_preview = true;
      }
      this.graph_ui_ctx.clearRect(0, 0, this.graph_ui_canvas.width, this.graph_ui_canvas.height);
      if ((ref = this.cur) != null) {
        ref.draw_ui();
      }
      ref1 = this.points;
      for (j = 0, len = ref1.length; j < len; j++) {
        order = ref1[j];
        for (k = 0, len1 = order.length; k < len1; k++) {
          p = order[k];
          p.draw_ui();
        }
      }
      return null;
    };

    LERPingSplines.prototype.update = function() {
      var j, len, order, p, ref, results;
      ref = this.points;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        order = ref[j];
        results.push((function() {
          var k, len1, results1;
          results1 = [];
          for (k = 0, len1 = order.length; k < len1; k++) {
            p = order[k];
            results1.push(p.update(this.t));
          }
          return results1;
        }).call(this));
      }
      return results;
    };

    LERPingSplines.prototype.draw_bezier = function() {
      var a, b, cp1, cp2, ctx;
      if (this.points[0].length <= 4) {
        a = this.points[0][0];
        cp1 = this.points[0][1];
        cp2 = this.points[0][2];
        b = this.points[0][3];
        ctx = this.graph_ctx;
        ctx.beginPath();
        ctx.strokeStyle = '#EC4444';
        ctx.lineWidth = 3;
        ctx.moveTo(a.position.x, a.position.y);
        ctx.bezierCurveTo(cp1.position.x, cp1.position.y, cp2.position.x, cp2.position.y, b.position.x, b.position.y);
        return ctx.stroke();
      }
    };

    LERPingSplines.prototype.draw = function() {
      var j, len, order, p, ref, results;
      this.graph_ctx.clearRect(0, 0, this.graph_canvas.width, this.graph_canvas.height);
      this.draw_bezier();
      ref = this.points;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        order = ref[j];
        results.push((function() {
          var k, len1, results1;
          results1 = [];
          for (k = 0, len1 = order.length; k < len1; k++) {
            p = order[k];
            results1.push(p.draw());
          }
          return results1;
        })());
      }
      return results;
    };

    LERPingSplines.prototype.update_and_draw = function() {
      this.update();
      return this.draw();
    };

    LERPingSplines.prototype.update_callback = function(timestamp) {
      var elapsed;
      this.frame_is_scheduled = false;
      elapsed = timestamp - this.prev_anim_timestamp;
      if (elapsed > 0) {
        this.prev_anim_timestamp = this.anim_timestamp;
        this.set_t(this.t + this.t_step);
        this.update();
        this.draw();
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
