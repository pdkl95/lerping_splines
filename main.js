(function() {
  var APP, LERPingSplines,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  APP = null;

  LERPingSplines = (function() {
    LERPingSplines.prototype.points = [];

    function LERPingSplines(context) {
      this.context = context;
      this.update = bind(this.update, this);
      this.redraw_ui = bind(this.redraw_ui, this);
      this.on_run = bind(this.on_run, this);
      this.on_num_points_changed = bind(this.on_num_points_changed, this);
    }

    LERPingSplines.prototype.init = function() {
      this.running = false;
      this.content_el = this.context.getElementById('content');
      this.graph_wrapper = this.context.getElementById('graph_wrapper');
      this.graph_canvas = this.context.getElementById('graph');
      this.graph_ui_canvas = this.context.getElementById('graph_ui');
      this.graph_ctx = this.graph_canvas.getContext('2d', {
        alpha: true
      });
      this.graph_ui_ctx = this.graph_ui_canvas.getContext('2d', {
        alpha: true
      });
      this.btn_run = $('#button_run').checkboxradio({
        icon: false
      });
      return this.num_points = $('#num_points').spinner({
        change: this.on_num_pointa_changed
      });
    };

    LERPingSplines.prototype.on_num_points_changed = function(event, ui) {};

    LERPingSplines.prototype.on_run = function() {
      if (this.running) {
        return this.stop();
      } else {
        return this.start();
      }
    };

    LERPingSplines.prototype.redraw_ui = function(render_bitmap_preview) {
      var i, len, p, ref, ref1;
      if (render_bitmap_preview == null) {
        render_bitmap_preview = true;
      }
      this.graph_ui_ctx.clearRect(0, 0, this.graph_ui_canvas.width, this.graph_ui_canvas.height);
      if ((ref = this.cur) != null) {
        ref.draw_ui();
      }
      ref1 = this.points;
      for (i = 0, len = ref1.length; i < len; i++) {
        p = ref1[i];
        p.draw_ui();
      }
      return null;
    };

    LERPingSplines.prototype.update = function() {
      this.frame_is_scheduled = false;
      this.multistep();
      if (this.running) {
        this.schedule_next_frame();
      }
      return null;
    };

    LERPingSplines.prototype.schedule_next_frame = function() {
      if (!this.frame_is_scheduled) {
        this.frame_is_scheduled = true;
        window.requestAnimationFrame(this.update);
      }
      return null;
    };

    return LERPingSplines;

  })();

  $(document).ready((function(_this) {
    return function() {
      APP = new LERPingSplines(document);
      return APP.init();
    };
  })(this));

}).call(this);
