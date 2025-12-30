window.APP = null

TAU = 2 * Math.PI

class LERPingSplines
  @create_point_margin: 0.12

  @point_radius: 5
  @point_move_margin: 24
  @point_label_flip_margin: 32

  @point_labels: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  @point_label_height: 22

  @pen_label_height: 22

  @mouseover_point_radius_boost: 6

  @storage_prefix = 'lerp_spline'

  constructor: (@context) ->

  init: () ->
    console.log('Starting init()...')

    @running = false

    @content_el = @context.getElementById('content')

    @show_tooltips = @context.getElementById('show_tooltips')
    @show_tooltips.addEventListener('change', @on_show_tooltips_change)
    @show_tooltips.checked = true    

    @option =
      connect_cubic_control_points:    new UI.BoolOption('connect_cubic_control_points', true)
      show_ticks:                      new UI.BoolOption('show_ticks', false)
      show_pen_label:                  new UI.BoolOption('show_pen_label', true)
      show_algorithm:                  new UI.BoolOption('show_algorithm', true)
      alt_algorithm_names:             new UI.BoolOption('alt_algorithm_names', true)
      rebalance_points_on_order_up:    new UI.BoolOption('rebalance_points_on_order_up', false)
      rebalance_points_on_order_down:  new UI.BoolOption('rebalance_points_on_order_down', false)
      show_tooltips:                   new UI.BoolOption('show_tooltips', true)
      mode:                            new UI.ChoiceOption('mode_choice', 'bezier')

    @option.show_ticks.register_callback
      on_change: @on_show_ticks_change
 
    @option.show_pen_label.register_callback
      on_change: @on_pen_label_change

    @option.alt_algorithm_names.register_callback
      on_change: @on_alt_algorithm_names_change

    @option.show_algorithm.register_callback
      on_true:  @on_show_algorithm_true
      on_false: @on_show_algorithm_false

    @option.mode.register_callback
      on_change: @on_mode_change

    @bezier_mode = false
    @spline_mode = false

    @graph_wrapper   = @find_element('graph_wrapper')
    @graph_canvas    = @find_element('graph')
    #@graph_ui_canvas = @context.getElementById('graph_ui')

    @graph_ctx    = @graph_canvas.getContext('2d', alpha: true)
    #graph_ui_ctx = @graph_ui_canvas.getContext('2d', alpha: true)

    @graph_ctx.font = "bold #{LERPingSplines.point_label_height}px sans-serif"

    @graph_width  = @graph_canvas.width
    @graph_height = @graph_canvas.height

    @point_move_margin =
      min_x: LERPingSplines.point_move_margin
      min_y: LERPingSplines.point_move_margin
      max_x: @graph_width  - LERPingSplines.point_move_margin
      max_y: @graph_height - LERPingSplines.point_move_margin

    @point_label_flip_margin =
      min_x: LERPingSplines.point_label_flip_margin
      min_y: LERPingSplines.point_label_flip_margin
      max_x: @graph_width  - LERPingSplines.point_label_flip_margin
      max_y: @graph_height - LERPingSplines.point_label_flip_margin

    @bezier_curve = new Bezier()
    @spline_curve = new Spline()

    @tvar = @context.getElementById('tvar')

    @tslider_btn_min = @find_element('tbox_slider_btn_min')
    @tslider_btn_min.addEventListener('click', @on_tslide_btn_min_click)

    @tslider_btn_max = @find_element('tbox_slider_btn_max')
    @tslider_btn_max.addEventListener('click', @on_tslide_btn_max_click)

    @tslider_bg = @find_element('tbox_slider')
    @tslider_bg.addEventListener('click', @on_tslider_bg_click)

    @tslider =
      handle: @find_element('tbox_slider_handle')
      min: 0
      max: 264
      drag_active: false
    @tslider.position = @tslider.min
    @tslider.range = @tslider.max - @tslider.min
    @tslider.handle.addEventListener('mousedown', @on_tslider_mousedown)

    @btn_play_pause = @find_element('button_play_pause')
    @btn_play_pause.addEventListener('click',@on_btn_play_pause_click)

    @num_points = @find_element('num_points')
 
    @points_wrapper = @find_element('points_wrapper')

    @add_point_btn = @find_element('add_point')
    @add_point_btn?.addEventListener('click', @on_add_point_btn_click)

    @remove_point_btn = @find_element('remove_point')
    @remove_point_btn?.addEventListener('click', @on_remove_point_btn_click)

    @num_order = @find_element('num_order')

    @order_wrapper = @find_element('order_wrapper')

    @add_order_btn = @find_element('add_order')
    @add_order_btn?.addEventListener('click', @on_add_order_btn_click)

    @sub_order_btn = @find_element('sub_order')
    @sub_order_btn?.addEventListener('click', @on_sub_order_btn_click)

    @num_segments = @find_element('num_segments')

    @segment_wrapper = @find_element('segment_wrapper')

    @add_segment_btn = @find_element('add_segment')
    @add_segment_btn?.addEventListener('click', @on_add_segment_btn_click)

    @sub_segment_btn = @find_element('sub_segment')
    @sub_segment_btn?.addEventListener('click', @on_sub_segment_btn_click)

    @algorithmbox   = @find_element('algorithmbox')
    @algorithm_text = @find_element('algorithm_text')

    @bezier_curve.add_initial_points()
    @spline_curve.add_initial_points()

    @option.mode.change()

    @reset_loop()

    @shift = false

    @context.addEventListener('keydown',   @on_keydown)
    @context.addEventListener('keyup',     @on_keyup)
    @context.addEventListener('mousemove', @on_mousemove)
    @context.addEventListener('mousedown', @on_mousedown)
    @context.addEventListener('mouseup',   @on_mouseup)

    console.log('init() completed!')

    @update()
    @stop()

    #@debug("Ready!")

  debug: (msg_text) ->
    console.log(msg_text)
    unless @debugbox?
      @debugbox = @context.getElementById('debugbox')
      @debugbox.classList.remove('hidden')

    hdr = @create_element('span', class: ['hdr'])
    msg = @create_element('span', class: ['msg'])

    timestamp = new Date()
    hdr.textContent = timestamp.toISOString()
    msg.textContent = '' + msg_text

    line = @create_element('div', class: ['dbg_line'])
    line.appendChild(hdr)
    line.appendChild(msg)
    @debugbox.appendChild(line)

    #@debugbox.animate({ scrollTop: @debugbox.prop("scrollHeight")}, 600);
    #@debugbox.scrollTop = @debugbox.scrollHeight

  fatal_error: (msg) ->
    @runhing = false
    msg = "FATAL ERROR: #{msg}"
    @debug(msg)

  assert_never_reached: ->
    @fatal_error("assert_never_reached() was reached")

  create_element: (tag_name, opt = {}) ->
    el = @context.createElement(tag_name)
    if opt['class']?
      for klass in opt['class']
        el.classList.add(klass)
    el

  find_element: (id) ->
    el = @context.getElementById(id)
    @debug("ERROR: missing element ##{id}") unless el?
    el

  storage_key: (key) ->
    "#{@constructor.storage_prefix}-#{key}"

  storage_set: (key, value, default_value = null) ->
    if default_value? and (default_value is value)
      @storage_remove(key)
    else
      localStorage.setItem(@storage_key(key), value)

  storage_get: (key) ->
    localStorage.getItem(@storage_key(key))

  storage_get_int: (key) ->
    parseInt(@storage_get(key))

  storage_get_float: (key) ->
    parseFloat(@storage_get(key))

  storage_remove: (key) ->
    localStorage.removeItem(@storage_key(key))

  reset_loop: ->
    @t = 0
    @t_step = 0.002
    @set_tslider_position(@tslider.min)

  loop_start: ->
    @loop_running = true

  loop_stop: ->
    @loop_running = false

  configure_for_bezier_mode: ->
    console.log("configure for mode: bezier")
    @bezier_mode = true
    @spline_mode = false
    @curve = @bezier_curve

    @order_wrapper.classList.add('hidden')
    @segment_wrapper.classList.add('hidden')
    @points_wrapper.classList.remove('hidden')

    @update_and_draw()

  configure_for_spline_mode: ->
    console.log("configure for mode: spline")
    @bezier_mode = false
    @spline_mode = true
    @curve = @spline_curve

    @order_wrapper.classList.remove('hidden')
    @segment_wrapper.classList.remove('hidden')
    @points_wrapper.classList.add('hidden')

    @update_and_draw()

  change_mode: (mode, update_opt = true) ->
    @option.mode.set(mode) if update_opt

    switch mode
      when 'bezier' then @configure_for_bezier_mode()
      when 'spline' then @configure_for_spline_mode()
      else
        @fatal_error("bad mode name \"#{mode}\"")

  on_mode_change: =>
    @change_mode(@option.mode.get(), false)

  on_show_tooltips_change: (event) =>
    if @show_tooltips.checked
      @content_el.classList.add('show_tt')
    else
      @content_el.classList.remove('show_tt')

  on_show_ticks_change: =>
    @update_and_draw()

  on_pen_label_change: =>
    @update_and_draw()

  on_alt_algorithm_names_change: =>
    @update_algorithm()

  on_add_point_btn_click: (event, ui) =>
    @curve.enable_point(true)
    @update_and_draw()

  on_remove_point_btn_click: (event, ui) =>
    @curve.disable_point()
    @update_and_draw()

  on_add_order_btn_click: (event, ui) =>
    @curve.add_order()
    @update_and_draw()

  on_sub_order_btn_click: (event, ui) =>
    @curve.sub_order()
    @update_and_draw()

  on_add_segment_btn_click: (event, ui) =>
    @curve.add_segment()
    @update_and_draw()

  on_sub_segment_btn_click: (event, ui) =>
    @curve.sub_segment()
    @update_and_draw()

  on_btn_play_pause_click: (event, ui) =>
    if @running
      @stop()
      console.log(@curve)
      console.log(@curve.points)
    else
      @start()

  set_tslider_position: (x) ->
    x = @tslider.min if x < @tslider.min
    x = @tslider.max if x > @tslider.max

    @tslider.position = x
    @tslider.handle.style.left = "#{x}px"
    @set_t_perc( (x - @tslider.min) / @tslider.range )

  on_tslider_bg_click: (event) =>
    cc = @tslider_bg.getBoundingClientRect()
    coord_x = event.pageX - cc.left
    coord_x -= window.scrollX
    t = coord_x / cc.width
    slider_pos = @tslider.min + (t * (@tslider.max - @tslider.min))
    @set_tslider_position(slider_pos)
    @update_and_draw()

  on_tslide_btn_min_click: =>
    @set_tslider_position(@tslider.min)
    @update_and_draw()

  on_tslide_btn_max_click: =>
    @set_tslider_position(@tslider.max)
    @update_and_draw()

  set_t: (value) ->
    @t_real = value 
    max = @curve.t_max()
    @t_real -= max while @t_real > max
    @t_perc = (@t_real - @curve.t_min()) / max

    @t = @t_real
    if @t > 0
      if @spline_mode
        @curve.set_t_segment(Math.floor(@t_real))
        @t = @t_real - @curve.t_segment

    @tvar.textContent = (@t_real.toFixed(2))

    if @t_real == @curve.t_min()
      @tslider_btn_min.disabled = true
    else
      @tslider_btn_min.disabled = false

    if @t_real >= @curve.t_max()
      @t = 1.0
      @tslider_btn_max.disabled = true
    else
      @tslider_btn_max.disabled = false

  set_t_perc: (value) ->
    min = @curve.t_min()
    @set_t( (value * (@curve.t_max() - min)) + min )

  start: =>
    if @running
      # do nothing
    else
      @running = true
      @btn_play_pause.innerHTML = "&#x23F8;"
      @schedule_first_frame()

  stop: =>
    @running = false
    @btn_play_pause.innerHTML = "&#x23F5;"

  update_algorithm: ->
    return unless @curve?

    if @option.show_algorithm.value
      @algorithm_text.innerText = @curve.get_algorithm_text()

  on_show_algorithm_true: =>
    @algorithmbox.classList.remove('hidden')
    @update_algorithm()

  on_hide_algorithm_false: =>
    @algorithmbox.classList.add('hidden')

  clamp_to_canvas: (v) ->
    v.x = @point_move_margin.min_x if v.x < @point_move_margin.min_x
    v.y = @point_move_margin.min_y if v.y < @point_move_margin.min_y
    v.x = @point_move_margin.max_x if v.x > @point_move_margin.max_x
    v.y = @point_move_margin.max_y if v.y > @point_move_margin.max_y
    v

  get_mouse_coord: (event) ->
    cc = @graph_canvas.getBoundingClientRect()
    coord =
      x: event.pageX - cc.left
      y: event.pageY - cc.top

    coord.x -= window.scrollX
    coord.y -= window.scrollY

    @clamp_to_canvas(coord)

  on_mousemove_tslider: (event) =>
    mouse = @get_mouse_coord(event)
    offset = mouse.x - @tslider.drag_start
    @set_tslider_position(@tslider.drag_start_position + offset)
    @update_and_draw()

  on_mousemove_canvas: (event) =>
    mouse = @get_mouse_coord(event)
    for p from @curve.each_point()
      oldx = p.x
      oldy = p.y
      dx = mouse.x - oldx
      dy = mouse.y - oldy
      if p.selected
        if (p.x != mouse.x) or (p.y != mouse.y)
          @point_has_changed = true

        p.x = mouse.x
        p.y = mouse.y

        if @spline_mode && (@curve.order == 3) && APP.option.connect_cubic_control_points.get()
          if p.knot
            if p.prev?
              p.prev.x += dx
              p.prev.y += dy
            if p.next?
              p.next.x += dx
              p.next.y += dy
          else
            unless @shift
              if p.prev? and p.prev.prev? and p.prev.knot
                p.prev.prev.mirror_around_next_knot()
              else if p.next? and p.next.next? and p.next.knot
                p.next.next.mirror_around_prev_knot()

      oldhover = p.hover
      if p.contains(mouse.x, mouse.y)
        p.hover = true
      else
        p.hover = false

      if (p.hover != oldhover) or (p.x != oldx) or (p.y != oldy)
        @update_and_draw()

  on_mousemove: (event) =>
    if @tslider.drag_active
      @on_mousemove_tslider(event)
    else
      @on_mousemove_canvas(event)

  on_tslider_mousedown: (event) =>
    @tslider.drag_active = true
    mouse = @get_mouse_coord(event)
    @tslider.drag_start = mouse.x
    @tslider.drag_start_position = @tslider.position
    @tslider.handle.classList.add('drag')
    @stop() if @running

  on_mousedown: (event) =>
    @point_has_changed = false
    mouse = @get_mouse_coord(event)
    p = @curve.find_point(mouse.x, mouse.y)
    if p?
      p.selected = true

  on_mouseup_tslider: (event) =>
    @tslider.drag_active = false
    @tslider.handle.classList.remove('drag')

  on_mouseup_canvas: (event) =>
    for p from @curve.each_point()
      p.selected = false

    if @point_has_changed
      @update_algorithm()

  on_mouseup: (event) =>
    if @tslider.drag_active
      @on_mouseup_tslider(event)
    else
      @on_mouseup_canvas(event)

  on_keydown: (event) =>
    switch event.key
      when "Shift" then @shift = true

  on_keyup: (event) =>
    switch event.key
      when "Shift" then @shift = false

  draw: =>
    @curve.draw()

  redraw_ui: (render_bitmap_preview = true) =>
    @graph_ui_ctx.clearRect(0, 0, @graph_ui_canvas.width, @graph_ui_canvas.height)

    #@cur?.draw_ui()

    for order in @canvas.points
      for p in order
        p.draw_ui()

    return null

  update_at: (t) =>
    @curve.update_at(t)

  update: =>
    @update_at(@t)

  update_and_draw: ->
    @graph_ctx.clearRect(0, 0, @graph_canvas.width, @graph_canvas.height)
    @curve.draw_ticks() if @option.show_ticks.value
    @curve.draw_curve()
    @update()
    @curve.draw()
    @curve.draw_pen() if @option.show_pen_label.value

  update_callback: (timestamp) =>
    @frame_is_scheduled = false
    elapsed = timestamp - @prev_anim_timestamp
    if elapsed > 0
      @prev_anim_timestamp = @anim_timestamp
      #console.log('t', @t, 't_real', @t_real, 't_perc', @t_perc, 't_step', @t_step)
      @set_t_perc( @t_perc + @t_step )
      @set_tslider_position(@tslider.min + (@t_perc * @tslider.range))
      @update_and_draw()

    @schedule_next_frame() if @running
    return null

  schedule_next_frame: =>
    if @running
      unless @frame_is_scheduled
        @frame_is_scheduled = true
        window.requestAnimationFrame(@update_callback)
    return null

  first_update_callback: (timestamp) =>
    @anim_timestamp      = timestamp
    @prev_anim_timestamp = timestamp
    @frame_is_scheduled = false
    @schedule_next_frame()
   
  schedule_first_frame: =>
    if @running
      @frame_is_scheduled = true
      window.requestAnimationFrame(@first_update_callback)
    return null

document.addEventListener 'DOMContentLoaded', =>
  window.APP = new LERPingSplines(document)
  window.APP.init()
  window.APP.draw()
