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
      this.order = 0;
      this.radius = 5;
      if (this.color == null) {
        this.color = '#000';
      }
      this.move(x, y);
    }

    Point.prototype.move = function(x, y) {
      this.x = x;
      this.y = y;
      this.ix = Math.floor(this.x);
      return this.iy = Math.floor(this.y);
    };

    Point.prototype.position = function() {
      return [this.x, this.y];
    };

    Point.prototype.draw = function() {
      var ctx;
      ctx = APP.graph_ctx;
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
      console.log("lerp<" + this.order + "> color", this.color);
    }

    LERP.prototype.interpolate = function(t, a, b) {
      return (t * a) + ((1 - t) * b);
    };

    LERP.prototype.position = function(t) {
      return [this.interpolate(t, this.from.x, this.to.x), this.interpolate(t, this.from.x, this.to.x)];
    };

    LERP.prototype.draw = function(t) {
      var ctx, p;
      p = this.position(t);
      ctx = APP.graph_ctx;
      ctx.strokeStyle = this.color;
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.moveTo(this.from.x, this.from.y);
      ctx.lineTo(this.to.x, this.to.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.arc(p[0], p[1], this.radius, 0, TAU);
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
      this.stop = bind(this.stop, this);
      this.start = bind(this.start, this);
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
      this.tslider_handle = $('#tbox_slider_handle');
      this.tslider = $('#tbox_slider').slider({
        slide: this.on_tslider_slide
      });
      console.log('init() completed!');
      this.reset_loop();
      return this.add_initial_points();
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
      var base, i, k, ref, results;
      this.max_lerp_order = n;
      results = [];
      for (i = k = 0, ref = n; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
        results.push((base = this.points)[i] || (base[i] = []));
      }
      return results;
    };

    LERPingSplines.prototype.reset_loop = function() {
      this.t = 0;
      return this.t_step = 0.02;
    };

    LERPingSplines.prototype.loop_start = function() {
      return this.loop_running = true;
    };

    LERPingSplines.prototype.loop_stop = function() {
      return this.loop_running = false;
    };

    LERPingSplines.prototype.add_initial_points = function() {
      this.add_point(0.12 * this.graph_width, 0.10 * this.graph_height);
      this.add_point(0.28 * this.graph_width, 0.82 * this.graph_height);
      this.add_point(0.85 * this.graph_width, 0.92 * this.graph_height);
      this.add_point(0.94 * this.graph_width, 0.15 * this.graph_height);
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
      var i, k, pi, plen, prev, ref, results, target;
      results = [];
      for (i = k = 1, ref = this.max_lerp_order; 1 <= ref ? k <= ref : k >= ref; i = 1 <= ref ? ++k : --k) {
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
      return this.tslider_handle.text(ui.value);
    };

    LERPingSplines.prototype.start = function() {
      if (this.running) {

      } else {
        this.running = true;
        return this.schedule_first_frame();
      }
    };

    LERPingSplines.prototype.stop = function() {
      return this.running = false;
    };

    LERPingSplines.prototype.redraw_ui = function(render_bitmap_preview) {
      var k, len, p, ref, ref1;
      if (render_bitmap_preview == null) {
        render_bitmap_preview = true;
      }
      this.graph_ui_ctx.clearRect(0, 0, this.graph_ui_canvas.width, this.graph_ui_canvas.height);
      if ((ref = this.cur) != null) {
        ref.draw_ui();
      }
      ref1 = this.points;
      for (k = 0, len = ref1.length; k < len; k++) {
        p = ref1[k];
        p.draw_ui();
      }
      return null;
    };

    LERPingSplines.prototype.update = function(elapsed) {
      this.t += this.t_step;
      while (this.t >= 1.0) {
        this.t -= 1.0;
      }
      return this.tvar.text(this.t);
    };

    LERPingSplines.prototype.draw = function() {
      var j, k, len, order, ref, results;
      this.graph_ctx.clearRect(0, 0, this.graph_canvas.width, this.graph_canvas.height);
      console.log(this.max_lerp_order, this.points);
      ref = this.points;
      results = [];
      for (k = 0, len = ref.length; k < len; k++) {
        order = ref[k];
        console.log('order', order);
        results.push((function() {
          var l, len1, results1;
          results1 = [];
          for (l = 0, len1 = order.length; l < len1; l++) {
            j = order[l];
            console.log('d', j);
            results1.push(j.draw(this.t));
          }
          return results1;
        }).call(this));
      }
      return results;
    };

    LERPingSplines.prototype.update_callback = function(timestamp) {
      var elapsed;
      this.frame_is_scheduled = false;
      elapsed = timestamp - this.prev_anim_timestamp;
      if (elapsed > 0) {
        this.prev_anim_timestamp = this.anim_timestamp;
        this.update(elapsed);
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
