APP = null

TAU = 2 * Math.PI

class Vec2
  @lerp: (a, b, amount) ->
    return
      x: a.x + (amount * (b.x - a.x))
      y: a.y + (amount * (b.y - a.y))

  @scale: (v, scale) ->
    return
      x: v.x * scale
      y: v.y * scale

  @rotate: (v, angle) ->
    c = Math.cos(angle)
    s = Math.sin(angle)
    return
      x: (v.x * c) - (v.y * s)
      y: (v.x * s) + (v.y * c)

  @normalize: (v) ->
    result =
      x: 0.0
      y: 0.0

    length = Math.sqrt((v.x*v.x) + (v.y*v.y))

    if length > 0
      ilength = 1.0 / length;
      result.x = v.x * ilength
      result.y = v.y * ilength

    result


class Point
  constructor: (x, y, @color) ->
    @enabled = false

    @hover = false
    @selected = false

    @order = 0
    @radius = LERPingSplines.point_radius
    @color ?= '#000'

    @position =
      x: x
      y: y

    @label_position =
      x: x
      y: y

    @move x, y

  set_label: (@label) ->
    @label_metrics = APP.graph_ctx.measureText(@label)
    @label_width   = @label_metrics.width
    @label_height  = LERPingSplines.point_label_height

  move: (x, y) ->
    @x = x
    @y = y

    @ix = Math.floor(@x)
    @iy = Math.floor(@y)

  contains: (x, y) ->
    dx = @x - x
    dy = @y - y
    dist = Math.sqrt((dx * dx) + (dy * dy))
    return dist <= @radius + LERPingSplines.mouseover_point_radius_boost

  update: (t) ->
    @position.x = @x
    @position.y = @y

    if @position.x < (APP.graph_width / 2.0)
      @label_position.x = @position.x - @label_width - 13
    else
      @label_position.x = @position.x + @label_width - 1

    if @position.y < (APP.graph_height / 2.0)
      @label_position.y = @position.y - @label_height + 2
    else
      @label_position.y = @position.y + @label_height + 8

  draw: ->
    return unless @enabled

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

    if @label
      ctx.fillStyle = '#000'
      ctx.fillText(@label, @label_position.x, @label_position.y);


class LERP extends Point
  constructor: (@order, @from, @to) ->
    @enabled = false

    @radius = 5

    @color = switch @order
      when 1 then '#000'
      when 2 then '#2D42DC'
      when 3 then '#A243DC'
      when 4 then '#D44143'
      when 5 then '#D98F46'
      when 6 then '#70D942'
      when 7 then '#6E55FF'
      else '#555'

    #@color = "rgb(#{color_fract},#{color_fract},#{color_fract})"
    console.log("lerp<#{@order}> color", @color)

    @position =
      x: @from.x
      y: @from.y

    @prev_position =
      x: null
      y: null

  interpolate: (t, a, b) ->
    (t * b) + ((1 - t) * a)

  update: (t) ->
    @enabled = @from.enabled and @to.enabled
    #return unless @enabled

    #console.log("update lerp<#{@order}> t=#{t}")
    @position.x = @interpolate(t, @from.position.x, @to.position.x)
    @position.y = @interpolate(t, @from.position.y, @to.position.y)
    #console.log('from', @from)
    #console.log('to', @to)
    #console.log("position = [#{@position.x},#{@position.y}]")

  draw: ->
    return unless @enabled

    #console.log("draw lerp<#{@order}> at [#{@position.x},#{@position.y}]")
    ctx = APP.graph_ctx

    ctx.beginPath()
    ctx.strokeStyle = @color
    ctx.lineWidth = 1
    ctx.moveTo(@from.position.x, @from.position.y)
    ctx.lineTo(@to.position.x, @to.position.y)
    ctx.stroke()

    ctx.beginPath()
    if APP.pen is this
      ctx.arc(@position.x, @position.y, @radius + 3, 0, TAU);
      ctx.fillStyle = @color
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 2
      ctx.globalOpacity = 0.4
      ctx.stroke()
      ctx.globalOpacity = 1.0
    else
      ctx.lineWidth = 3
      ctx.arc(@position.x, @position.y, @radius + 1, 0, TAU);
      ctx.stroke()


class LERPingSplines
  @min_points: 2
  @max_points: 8

  @max_lerp_order: ->
    LERPingSplines.max_points - 1

  @create_point_margin: 0.12

  @point_radius: 5
  @point_move_margin: 3

  @point_labels: "ABCDEFGHIJKLM"
  @point_label_height: 22

  @mouseover_point_radius_boost: 6

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

    @graph_ctx.font = "bold #{LERPingSplines.point_label_height}px sans-serif"

    @graph_width  = @graph_canvas.width
    @graph_height = @graph_canvas.height

    @point_move_margin =
      min_x: LERPingSplines.point_move_margin
      min_y: LERPingSplines.point_move_margin
      max_x: @graph_width  - LERPingSplines.point_move_margin
      max_y: @graph_height - LERPingSplines.point_move_margin

    @points = []
    @enabled_points = 0

    @reset_loop()

    @btn_play_pause = $('#button_play_pause').button
      icon: 'ui-icon-play'
      showLabel: false
    @btn_play_pause.click(@on_btn_play_pause_click)

    @num_points = $('#num_points')

    @add_point_btn = $('#add_point').button
      icon: 'ui-icon-plus'
      showLabel: false
    @add_point_btn.click(@on_add_point_btn_click)

    @remove_point_btn = $('#remove_point').button
      icon: 'ui-icon-minus'
      showLabel: false
    @remove_point_btn.click(@on_remove_point_btn_click)

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

    @add_initial_points()
    @update()

  debug: (msg_text) ->
    unless @debugbox?
      @debugbox = $('#debugbox')
      @debugbox.removeClass('hidden')

    hdr = $('<span/>',  class: 'hdr')
    msg = $('<span/>',  class: 'msg')

    timestamp = new Date()
    hdr.text(timestamp.toISOString())
    msg.text('' + msg_text)

    line = $('<div/>', class: "dbg_line").append([ hdr, msg ])
    @debugbox.append(line)

    @debugbox.animate({ scrollTop: @debugbox.prop("scrollHeight")}, 600);

  reset_loop: ->
    @t = 0
    @t_step = 0.002

  loop_start: ->
    @loop_running = true

  loop_stop: ->
    @loop_running = false

  add_initial_points: ->
    margin = LERPingSplines.create_point_margin
    range = 1.0 - (2.0 * margin)

    @points[0] = []
    for i in [0..LERPingSplines.max_points]
      x = margin + (range * Math.random())
      y = margin + (range * Math.random())
      @points[0][i] = new Point(x * @graph_width, y * @graph_height)
      @points[0][i].set_label( LERPingSplines.point_labels[i] )

    for order in [1..LERPingSplines.max_points]
      @points[order] = []
      prev_order = order - 1
      prev = @points[prev_order]
      for j in [0..(LERPingSplines.max_points - order)]
        lerp = new LERP( order, prev[j], prev[j+1] )
        @points[order][j] = lerp

    @enable_point_at( 0.06, 0.85 )
    @enable_point_at( 0.15, 0.08 )
    @enable_point_at( 0.72, 0.18 )
    @enable_point_at( 0.88, 0.90 )

    @update_enabled_points()

    console.log('Initial points created!')

  find_point: (x, y) ->
    for p in @points[0]
      if p?.contains(x, y)
        return p    
    return null

  update_enabled_points: ->
    if @enabled_points < LERPingSplines.max_points
      @add_point_btn.button("enable")
    else
      @add_point_btn.button("disable")

    if @enabled_points > LERPingSplines.min_points
      @remove_point_btn.button("enable")
    else
      @remove_point_btn.button("disable")

    @num_points.text("#{@enabled_points}")

    @update()

  enable_point: ->
    return if @enabled_points >= LERPingSplines.max_points
    p = @points[0][@enabled_points]
    @enabled_points += 1
    p.enabled = true
    @update_enabled_points()
    p

  enable_point_at: (x, y) ->
    p = @enable_point()
    p.x = x * @graph_width
    p.y = y * @graph_height
    p

  disable_point: ->
    return if @enabled_points <= LERPingSplines.min_points
    @enabled_points -= 1
    p = @points[0][@enabled_points]
    p.enabled = false
    @update_enabled_points()
    p

  on_add_point_btn_click: (event, ui) =>
    @enable_point()
    @update_and_draw()

  on_remove_point_btn_click: (event, ui) =>
    @disable_point()
    @update_and_draw()

  on_btn_play_pause_click: (event, ui) =>
    if @running
      @stop()
    else
      @start()

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
    if @running
      # do nothing
    else
      @running = true
      @btn_play_pause.button("option", "icon", "ui-icon-pause")
      @schedule_first_frame()

  stop: =>
    if @running
      @running = false
      @btn_play_pause.button("option", "icon", "ui-icon-play")
    else
      # do nothing

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
    @clamp_to_canvas(coord)

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

  update_at: (t) =>
    for order in @points
      for p in order
        p.update(t)

  update: =>
    @update_at(@t)

  draw_bezier: ->
    start = @points[0][0]

    p = null
    for i in [(LERPingSplines.max_points - 1)..1]
      p = @points[i][0]
      if p?.enabled
        break

    ctx = @graph_ctx
    ctx.beginPath()
    ctx.strokeStyle = p.color
    ctx.lineWidth = 3

    t = 0.0
    @update_at(t)
    ctx.moveTo(p.position.x, p.position.y)
    while t < 1.0
      t += 0.02
      @update_at(t)
      ctx.lineTo(p.position.x, p.position.y)

    ctx.stroke()

    @pen = p

  draw: ->
    for order in @points
      for p in order
        if p.order > 1
          p.draw()
    for p in @points[1]
      p.draw()
    for p in @points[0]
      p.draw()

  draw_pen: ->
    return unless @pen?

    @update_at(@t - @t_step)
    @pen.prev_position.x = @pen.position.x
    @pen.prev_position.y = @pen.position.y
    @update()

    if @pen.prev_position.x? and @pen.prev_position.y?
      normal =
        x: -(@pen.position.y - @pen.prev_position.y)
        y:  (@pen.position.x - @pen.prev_position.x)

      normal = Vec2.normalize(normal)

      arrow    = Vec2.scale(normal, 22.0)
      arrowtip = Vec2.scale(normal, 15.0)
      normal   = Vec2.scale(normal, 65.0)

      angle = TAU / 8.0
      arrow1 = Vec2.rotate(arrow, angle)
      arrow2 = Vec2.rotate(arrow, -angle)

      arrowtip.x += @pen.position.x
      arrowtip.y += @pen.position.y

      ctx = @graph_ctx
      ctx.beginPath()
      ctx.moveTo(arrowtip.x, arrowtip.y)
      ctx.lineTo(arrowtip.x + normal.x, arrowtip.y + normal.y)
      ctx.moveTo(arrowtip.x, arrowtip.y)
      ctx.lineTo(arrowtip.x + arrow1.x, arrowtip.y + arrow1.y)
      ctx.moveTo(arrowtip.x, arrowtip.y)
      ctx.lineTo(arrowtip.x + arrow2.x, arrowtip.y + arrow2.y)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.lineCap = "round"
      ctx.stroke()

  update_and_draw: ->
    @graph_ctx.clearRect(0, 0, @graph_canvas.width, @graph_canvas.height)
    @draw_bezier()
    @update()
    @draw()
    @draw_pen()

  update_callback: (timestamp) =>
    @frame_is_scheduled = false
    elapsed = timestamp - @prev_anim_timestamp
    if elapsed > 0
      @prev_anim_timestamp = @anim_timestamp
      @set_t( @t + @t_step )
      @update_and_draw()

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
