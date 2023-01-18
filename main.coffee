APP = null

TAU = 2 * Math.PI

class Point
  constructor: (x, y, @color) ->
    @order = 0
    @radius = 5
    @color ?= '#000'
    @move x, y

  move: (x, y) ->
    @x = x
    @y = y

    @ix = Math.floor(@x)
    @iy = Math.floor(@y)

  position: ->
    [@x, @y]

  draw: ->
    #console.log('draw point', @x, @y, @color)
    ctx = APP.graph_ctx
    ctx.beginPath()
    ctx.fillStyle = @color
    ctx.arc(@x, @y, @radius, 0, TAU);
    ctx.fill()

class LERP extends Point
  constructor: (@from, @to) ->
    @order = @from.order + 1

    @radius = 5

    color_fract = @order / (APP.max_lerp_order + 2)
    color_fract *= 255
    @color = "rgb(#{color_fract},#{color_fract},#{color_fract})"
    console.log("lerp<#{@order}> color", @color)

  interpolate: (t, a, b) ->
    (t * a) + ((1 - t) * b)

  position: (t) ->
    [ @interpolate(t, @from.x, @to.x), @interpolate(t, @from.x, @to.x) ]

  draw: (t) ->
    p = @position(t)
    #console.log("draw lerp<#{@order}", p)
    ctx = APP.graph_ctx
    ctx.strokeStyle = @color

    ctx.beginPath()
    ctx.lineWidth = 1
    ctx.moveTo(@from.x, @from.y)
    ctx.lineTo(@to.x, @to.y)
    ctx.stroke()

    ctx.beginPath()
    ctx.lineWidth = 2
    ctx.arc(p[0], p[1], @radius, 0, TAU);
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
    @tslider_handle = $('#tbox_slider_handle')
    @tslider = $('#tbox_slider').slider
      slide: @on_tslider_slide
#      create: ->
#        @tslider_handle.text( @tslider.slider( "value" ) );

    console.log('init() completed!')

    @reset_loop()
    @add_initial_points()

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
    @t_step = 0.02

  loop_start: ->
    @loop_running = true

  loop_stop: ->
    @loop_running = false

  add_initial_points: ->
    @add_point( 0.12 * @graph_width, 0.10 * @graph_height )
    @add_point( 0.28 * @graph_width, 0.82 * @graph_height )
    @add_point( 0.85 * @graph_width, 0.92 * @graph_height )
    @add_point( 0.94 * @graph_width, 0.15 * @graph_height )

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
    @tslider_handle.text(ui.value)
    #@set_t()

  start: =>
    if @running
      # do nothing
    else
      @running = true
      @schedule_first_frame()

  stop: =>
    @running = false

  redraw_ui: (render_bitmap_preview = true) =>
    @graph_ui_ctx.clearRect(0, 0, @graph_ui_canvas.width, @graph_ui_canvas.height)

    @cur?.draw_ui()

    for p in @points
      p.draw_ui()

    return null

  update: (elapsed) =>
    @t += @t_step
    @t -= 1.0 while @t >= 1.0

    @tvar.text(@t)

  draw: ->
    @graph_ctx.clearRect(0, 0, @graph_canvas.width, @graph_canvas.height)
    #console.log('draw() beg')
    console.log(@max_lerp_order, @points)
    for order in @points
      console.log('order', order)
      for j in order
        console.log('d', j)
        j.draw(@t)
    #console.log('draw() end')

  update_callback: (timestamp) =>
    @frame_is_scheduled = false
    elapsed = timestamp - @prev_anim_timestamp
    if elapsed > 0
      @prev_anim_timestamp = @anim_timestamp
      @update(elapsed)
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
