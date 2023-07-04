APP = null

TAU = 2 * Math.PI

class Point
  constructor: (x, y, @color) ->
    @hover = false
    @selected = false

    @order = 0
    @radius = 5
    @color ?= '#000'

    @position =
      x: x
      y: y

    @move x, y

  move: (x, y) ->
    @x = x
    @y = y

    @ix = Math.floor(@x)
    @iy = Math.floor(@y)

  contains: (x, y) ->
    dx = @x - x
    dy = @y - y
    dist = Math.sqrt((dx * dx) + (dy * dy))
    return dist <= @radius

  update: (t) ->
    @position.x = @x
    @position.y = @y

  draw: ->
    #console.log('draw point', @x, @y, @color)
    ctx = APP.graph_ctx

    if @hover
      ctx.beginPath()
      ctx.fillStyle = '#ff0'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.arc(@x, @y, @radius * 3, 0, TAU)
      ctx.fill()
      ctx.stroke()

    ctx.beginPath()
    ctx.fillStyle = @color
    ctx.arc(@x, @y, @radius, 0, TAU)
    ctx.fill()


class LERP extends Point
  constructor: (@from, @to) ->
    @order = @from.order + 1

    @radius = 5

    color_fract = @order / (APP.max_lerp_order + 2)
    color_fract *= 255
    @color = "rgb(#{color_fract},#{color_fract},#{color_fract})"
    #console.log("lerp<#{@order}> color", @color)

    @position =
      x: @from.x
      y: @from.y

  interpolate: (t, a, b) ->
    (t * a) + ((1 - t) * b)

  update: (t) -> 
    #console.log("update lerp<#{@order}> t=#{t}")
    @position.x = @interpolate(t, @from.position.x, @to.position.x)
    @position.y = @interpolate(t, @from.position.y, @to.position.y)
    #console.log('from', @from)
    #console.log('to', @to)
    #console.log("position = [#{@position.x},#{@position.y}]")

  draw: ->
    #console.log("draw lerp<#{@order}> at [#{@position.x},#{@position.y}]")
    ctx = APP.graph_ctx

    ctx.beginPath()
    ctx.strokeStyle = @color
    ctx.lineWidth = 1
    ctx.moveTo(@from.position.x, @from.position.y)
    ctx.lineTo(@to.position.x, @to.position.y)
    ctx.stroke()

    ctx.beginPath()
    ctx.lineWidth = 3
    ctx.arc(@position.x, @position.y, @radius + 1, 0, TAU);
    ctx.stroke()


class LERPingSplines
  constructor: (@context) ->

  init: () ->
    console.log('Starting init()...')

    @running = false

    @content_el       = @context.getElementById('content')

    @graph_wrapper   = @context.getElementById('graph_wrapper')
    @graph_canvas    = @context.getElementById('graph')
    #@graph_ui_canvas = @context.getElementById('graph_ui')

    @graph_ctx    = @graph_canvas.getContext('2d', alpha: true)
    #graph_ui_ctx = @graph_ui_canvas.getContext('2d', alpha: true)

    @graph_width  = @graph_canvas.width
    @graph_height = @graph_canvas.height

    @points = []
    @set_max_lerp_order(3)

    @btn_run = $('#button_run').checkboxradio(icon: false)
    @btn_run.change(@on_btn_run_change)

    @num_points = $('#num_points').spinner
       change: @on_num_points_changed
       stop:   @on_num_points_changed

    @tvar = $('#tvar')

    @tslider_btn_min = $('#tbox_slider_btn_min').button
      showLabel: false
      icon:      'ui-icon-arrowthickstop-1-w'
      click:     @on_tslide_btn_min_click 
    @tslider_btn_min.click(@on_tslide_btn_min_click)

    @tslider_btn_max = $('#tbox_slider_btn_max').button
      showLabel: false
      icon:      'ui-icon-arrowthickstop-1-e'
    @tslider_btn_max.click(@on_tslide_btn_max_click)

    @tslider_saved_running_status = @running
    @tslider = $('#tbox_slider').slider
      min:   0.0
      max:   1.0
      step:  0.01
      change: @on_tslider_change
      slide:  @on_tslider_slide
      stop:   @on_tslider_stop
#      start:  @on_tslider_start

    @context.addEventListener('mousemove', @on_mousemove)
    @context.addEventListener('mousedown', @on_mousedown)
    @context.addEventListener('mouseup',   @on_mouseup)

    console.log('init() completed!')

    @reset_loop()
    @add_initial_points()
    @update()

  debug: (msg) ->
    unless @debugbox?
      @debugbox = $('#debugbox')
      @debugbox_hdr = @debugbox.find('.hdr')
      @debugbox_msg = @debugbox.find('.msg')
      @debugbox.removeClass('hidden')

    timestamp = new Date()
    @debugbox_hdr.text(timestamp.toISOString())
    @debugbox_msg.text('' + msg)

  set_max_lerp_order: (n) ->
    @max_lerp_order = n
    for i in [0..n]
      @points[i] ||= []

  reset_loop: ->
    @t = 0
    @t_step = 0.01

  loop_start: ->
    @loop_running = true

  loop_stop: ->
    @loop_running = false

  add_initial_points: ->
    @add_point( 0.88 * @graph_width, 0.90 * @graph_height )
    @add_point( 0.72 * @graph_width, 0.18 * @graph_height )
    @add_point( 0.15 * @graph_width, 0.08 * @graph_height )
    @add_point( 0.06 * @graph_width, 0.85 * @graph_height )

    console.log('Initial points created!')

  add_lerp: (from, to) ->
    lerp = new LERP(from, to)
    @points[lerp.order].push(lerp)

  remove_lerp: (order) ->
    #lerp =
    @points[order].pop()
    #lerp.destroy()

  fix_num_lerps: ->
    for i in [1..@max_lerp_order]
      pi = i - 1
      prev = @points[pi]
      plen = prev.length
      target = plen - 1

      while @points[i].length < target
        prev = @points[pi]
        plen = prev.length
        unless plen < 2
          @add_lerp( prev[plen - 2], prev[plen - 1] )

      # while @points[i].length > target
      #   @remove_lerp(i)

  find_point: (x, y) ->
    for order in @points
      for p in order
        if p.contains(x, y)
          return p
    return null

  add_point: (x, y) ->
    p = new Point(x, y)
    @points[0].push( p )
    @fix_num_lerps()

  remove_point: ->
    @remove_lerp(0)
    @fix_num_lerps()

  set_num_points: (target_num) -> 
    @add_point()    while @points.length < target_num
    @remove_point() while @points.length > target_num
 
  on_num_points_changed: (event, ui) =>
    msg = '[num_points] event: ' + event.type + ', value = ' + @num_points.val()
    #console.log(msg)
    @debug msg

  on_btn_run_change: (event, ui) =>
    checked = @btn_run.is(':checked')
    if checked
      @start()
    else
      @stop()

  on_tslider_slide: (event, ui) =>
    v = @tslider.slider("option", "value");
    @set_t(v)
    @update_and_draw()

  on_tslider_changer: (event, ui) =>
    @on_tslider_slide(event, ui)
    @update_and_draw()

  on_tslide_btn_min_click: =>
    @set_t(0.0)
    @update_and_draw()

  on_tslide_btn_max_click: =>
    @set_t(1.0)
    @update_and_draw()

  on_tslider_start: =>
    console.log('tslider start')
    #@tslider_saved_running_status = @running
    #@stop()

  on_tslider_stop: =>
    console.log('tslider stop')
    #@running = @tslider_saved_running_status
    @update_and_draw()
    @start() if @running

  set_t: (value) ->
    @t = value
    @t -= 1.0 while @t > 1.0
    @tvar.text(@t.toFixed(2))
    @tslider.slider("option", "value", @t)

  start: =>
    console.log('start()')
    if @running
      # do nothing
    else
      @running = true
      @schedule_first_frame()

  stop: =>
    console.log('stop()')
    @running = false

  get_mouse_coord: (event) ->
    cc = @graph_canvas.getBoundingClientRect()
    return
      x: event.pageX - cc.left
      y: event.pageY - cc.top

  on_mousemove: (event) =>
    mouse = @get_mouse_coord(event)
    for order in @points
      for p in order
        oldx = p.x
        oldy = p.y
        if p.selected
          p.x = mouse.x
          p.y = mouse.y

        oldhover = p.hover
        if p.contains(mouse.x, mouse.y)
          p.hover = true
        else
          p.hover = false

        if (p.hover != oldhover) or (p.x != oldx) or (p.y != oldy)
          @update_and_draw()

  on_mousedown: (event) =>
    mouse = @get_mouse_coord(event)
    p = @find_point(mouse.x, mouse.y)
    if p?
      p.selected = true

  on_mouseup: (event) =>
    for order in @points
      for p in order
        p.selected = false

  redraw_ui: (render_bitmap_preview = true) =>
    @graph_ui_ctx.clearRect(0, 0, @graph_ui_canvas.width, @graph_ui_canvas.height)

    @cur?.draw_ui()

    for order in @points
      for p in order
        p.draw_ui()

    return null

  update: =>
    for order in @points
      for p in order
        p.update(@t)

  draw_bezier: ->
    if @points[0].length <= 4
      a   = @points[0][0]
      cp1 = @points[0][1]
      cp2 = @points[0][2]
      b   = @points[0][3]

      ctx = @graph_ctx
      ctx.beginPath()
      ctx.strokeStyle = '#EC4444'
      ctx.lineWidth = 3
      ctx.moveTo(a.position.x, a.position.y)
      ctx.bezierCurveTo(cp1.position.x, cp1.position.y, cp2.position.x, cp2.position.y, b.position.x, b.position.y)
      ctx.stroke()

  draw: ->
    @graph_ctx.clearRect(0, 0, @graph_canvas.width, @graph_canvas.height)
    @draw_bezier()
    for order in @points
      for p in order
        p.draw()

  update_and_draw: ->
    @update()
    @draw()

  update_callback: (timestamp) =>
    @frame_is_scheduled = false
    elapsed = timestamp - @prev_anim_timestamp
    if elapsed > 0
      @prev_anim_timestamp = @anim_timestamp
      @set_t( @t + @t_step )
      @update()
      @draw()

    @schedule_next_frame() if @running
    return null
 
  schedule_next_frame: =>
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
    @frame_is_scheduled = true
    window.requestAnimationFrame(@first_update_callback)
    return null

$(document).ready =>
  APP = new LERPingSplines(document)
  APP.init()
  APP.draw()
