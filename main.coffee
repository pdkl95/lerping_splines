APP = null

TAU = 2 * Math.PI

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

  get_label: ->
    @label

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
    #console.log("lerp<#{@order}> color", @color)

    @position =
      x: @from.x
      y: @from.y

    @prev_position =
      x: null
      y: null

  generate_label: (order, index) ->
    @label = "#{@from.label}#{@to.label}"
    @alg_label = "temp_#{order}_#{index}"

  get_label: ->
    if APP.alt_algorithm_names
      @alg_label
    else
      @label

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

  @pen_label_height: 22

  @mouseover_point_radius_boost: 6

  constructor: (@context) ->

  init: () ->
    console.log('Starting init()...')

    @running = false
    @pen_label_enabled = true
    @algorithm_enabled = true
    @alt_algorithm_names = true

    @content_el       = @context.getElementById('content')

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

    @points = []
    @enabled_points = 0

    @tvar = @context.getElementById('tvar')

    @tslider_btn_min = @find_element('tbox_slider_btn_min')
    @tslider_btn_min.addEventListener('click', @on_tslide_btn_min_click)

    @tslider_btn_max = @find_element('tbox_slider_btn_max')
    @tslider_btn_max.addEventListener('click', @on_tslide_btn_max_click)

    @tslider =
      handle: @find_element('tbox_slider_handle')
      min: 0
      max: 264
      drag_active: false
    @tslider.position = @tslider.min
    @tslider.range = @tslider.max - @tslider.min
    @tslider.handle.addEventListener('mousedown', @on_tslider_mousedown)

    @reset_loop()

    @show_ticks_checkbox = @find_element('show_ticks')
    @show_ticks_checkbox.addEventListener('change', @on_show_ticks_checkbox)

    @btn_play_pause = @find_element('button_play_pause')
    @btn_play_pause.addEventListener('click',@on_btn_play_pause_click)

    @num_points = @find_element('num_points')

    @add_point_btn = @find_element('add_point')
    @add_point_btn?.addEventListener('click', @on_add_point_btn_click)

    @remove_point_btn = @find_element('remove_point')
    @remove_point_btn?.addEventListener('click', @on_remove_point_btn_click)

    @context.addEventListener('mousemove', @on_mousemove)
    @context.addEventListener('mousedown', @on_mousedown)
    @context.addEventListener('mouseup',   @on_mouseup)

    @pen_label = 'P'
    @pen_label_metrics = APP.graph_ctx.measureText(@pen_label)
    @pen_label_width   = @pen_label_metrics.width
    @pen_label_height  = LERPingSplines.pen_label_height
    @pen_label_offset =
      x: @pen_label_width  / 2
      y: @pen_label_height / 2

    @pen_label_offset_length = Vec2.magnitude(@pen_label_offset)

    @algorithmbox   = @find_element('algorithmbox')
    @algorithm_text = @find_element('algorithm_text')

    console.log('init() completed!')

    @add_initial_points()
    @update()
    @stop()

    if @algorithm_enabled
      @show_algorithm()
    else
      @hide_algorithm()

  debug: (msg_text) ->
    unless @debugbox?
      @debugbox = @context.getElementById('debugbox')
      @debugbox.classList.remove('hidden')

    hdr = $('<span/>',  class: 'hdr')
    msg = $('<span/>',  class: 'msg')

    timestamp = new Date()
    hdr.text(timestamp.toISOString())
    msg.text('' + msg_text)

    line = $('<div/>', class: "dbg_line").append([ hdr, msg ])
    @debugbox.append(line)

    @debugbox.animate({ scrollTop: @debugbox.prop("scrollHeight")}, 600);

  find_element: (id) ->
    el = @context.getElementById(id)
    @debug("ERROR: missing element ##{id}") unless el?
    el

  reset_loop: ->
    @t = 0
    @t_step = 0.002
    @set_tslider_position(@tslider.min)

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
        @points[order][j].generate_label(order, j)

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
      @add_point_btn.disabled = false
    else
      @add_point_btn.disabled = true

    if @enabled_points > LERPingSplines.min_points
      @remove_point_btn.disabled = false
    else
      @remove_point_btn.disabled = true

    @num_points.textContent = "#{@enabled_points}"

    @update()

    p = null
    for i in [(LERPingSplines.max_points - 1)..1]
      p = @points[i][0]
      if p?.enabled
        break
    if p?
      @pen = p
    else
      @debug("ERROR: no pen?!")

    @update_algorithm()

  enable_point: (rebalance_points) ->
    return if @enabled_points >= LERPingSplines.max_points
    p = @points[0][@enabled_points]

    if rebalance_points
      cur_id = @enabled_points
      prev_id = cur_id - 1
      while prev_id >= 0
        cur  = @points[0][cur_id]
        prev = @points[0][prev_id]

        k = @enabled_points

        x = ((k - cur_id) / k) * cur.position.x + (cur_id / k) * prev.position.x
        y = ((k - cur_id) / k) * cur.position.y + (cur_id / k) * prev.position.y

        cur.move(x, y)

        cur_id--
        prev_id--

    p.enabled = true
    @enabled_points += 1
    @update_enabled_points()
    p

  enable_point_at: (x, y) ->
    p = @enable_point(false)
    p.x = x * @graph_width
    p.y = y * @graph_height
    p

  compute_lower_order_curve: ->
    points = @points[0].map (point) ->
      return
        x: point.position.x
        y: point.position.y

    `/* copied from: https://pomax.github.io/bezierinfo/chapters/reordering/reorder.js */

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
    }));`

    for i in [0...points.length]
      p = @clamp_to_canvas(points[i])
      @points[0][i].move(p.x, p.y)
    
  disable_point: ->
    return if @enabled_points <= LERPingSplines.min_points

    if @enabled_points > 3
      @compute_lower_order_curve()

    @enabled_points -= 1
    p = @points[0][@enabled_points]
    p.enabled = false
    @update_enabled_points()

  on_show_ticks_checkbox: (event, ui) =>
    @update_and_draw()

  on_add_point_btn_click: (event, ui) =>
    @enable_point(true)
    @update_and_draw()

  on_remove_point_btn_click: (event, ui) =>
    @disable_point()
    @update_and_draw()

  on_btn_play_pause_click: (event, ui) =>
    if @running
      @stop()
    else
      @start()

  set_tslider_position: (x) ->
    x = @tslider.min if x < @tslider.min
    x = @tslider.max if x > @tslider.max

    @tslider.position = x
    @tslider.handle.style.left = "#{x}px"
    @set_t( (x - @tslider.min) / @tslider.range )

  on_tslide_btn_min_click: =>
    @set_tslider_position(@tslider.min)
    @update_and_draw()

  on_tslide_btn_max_click: =>
    @set_tslider_position(@tslider.max)
    @update_and_draw()

  set_t: (value) ->
    @t = value
    @t -= 1.0 while @t > 1.0
    @tvar.textContent = (@t.toFixed(2))

    if @t == 0.0
      @tslider_btn_min.disabled = true
    else
      @tslider_btn_min.disabled = false

    if @t == 1.0
      @tslider_btn_max.disabled = true
    else
      @tslider_btn_max.disabled = false

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
    lines = []
    for order in [0..(@enabled_points - 1)]
      if order > 0
        lines.push ""
        lines.push "### Order #{order} Bezier"
      else
        lines.push "### Points"

      for p in @points[order]
        continue unless p.enabled

        label = if p is @pen then @pen_label else p.get_label()

        if order > 0
          lines.push "#{label} = Lerp(#{p.from.get_label()}, #{p.to.get_label()}, t)"
        else
          lines.push "#{label} = <#{parseInt(p.position.x, 10)}, #{parseInt(p.position.y, 10)}>"

    @algorithm_text.innerText = lines.join("\n")

  show_algorithm: =>
    @algorithm_enabled = true
    @algorithmbox.classList.remove('hidden')
    @update_algorithm()

  hide_algorithm: =>
    @algorithm_enabled = false
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
    for order in @points
      for p in order
        oldx = p.x
        oldy = p.y
        if p.selected
          if (p.x != mouse.x) or (p.y != mouse.y)
            @point_has_changed = true
          p.x = mouse.x
          p.y = mouse.y

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
    p = @find_point(mouse.x, mouse.y)
    if p?
      p.selected = true

  on_mouseup_tslider: (event) =>
    @tslider.drag_active = false
    @tslider.handle.classList.remove('drag')

  on_mouseup_canvas: (event) =>
    for order in @points
      for p in order
        p.selected = false

    if @point_has_changed and @algorithm_enabled
      @update_algorithm()

  on_mouseup: (event) =>
    if @tslider.drag_active
      @on_mouseup_tslider(event)
    else
      @on_mouseup_canvas(event)

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

    @debug("missing pen") unless @pen?
    if p isnt @pen
      console.log('p',p)
      console.log('@pen',@pen)
    p = @pen

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

  draw: ->
    for order in @points
      for p in order
        if p.order > 1
          p.draw()
    for p in @points[1]
      p.draw()
    for p in @points[0]
      p.draw()

  get_normal: ->
    @update_at(@t - @t_step)
    @pen.prev_position.x = @pen.position.x
    @pen.prev_position.y = @pen.position.y
    @update()

    if @pen.prev_position.x? and @pen.prev_position.y?
      normal =
        x: -(@pen.position.y - @pen.prev_position.y)
        y:  (@pen.position.x - @pen.prev_position.x)

      Vec2.normalize(normal)
    else
      null

  draw_pen: ->
    return unless @pen?
    normal = @get_normal()
    if normal?
      arrow       = Vec2.scale(normal, 22.0)
      arrowtip    = Vec2.scale(normal, 15.0)
      arrow_shaft = Vec2.scale(normal, 65.0)

      angle = TAU / 8.0
      arrow_side1 = Vec2.rotate(arrow, angle)
      arrow_side2 = Vec2.rotate(arrow, -angle)

      arrowtip.x += @pen.position.x
      arrowtip.y += @pen.position.y

      ctx = @graph_ctx
      ctx.beginPath()
      ctx.moveTo(arrowtip.x, arrowtip.y)
      ctx.lineTo(arrowtip.x + arrow_shaft.x, arrowtip.y + arrow_shaft.y)
      ctx.moveTo(arrowtip.x, arrowtip.y)
      ctx.lineTo(arrowtip.x + arrow_side1.x, arrowtip.y + arrow_side1.y)
      ctx.moveTo(arrowtip.x, arrowtip.y)
      ctx.lineTo(arrowtip.x + arrow_side2.x, arrowtip.y + arrow_side2.y)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.lineCap = "round"
      ctx.stroke()

      if @pen_label_enabled
        plabel_offset = Vec2.scale(Vec2.normalize(arrow_shaft), @pen_label_offset_length + 3)
        plx = arrowtip.x + arrow_shaft.x + plabel_offset.x - @pen_label_offset.x
        ply = arrowtip.y + arrow_shaft.y + plabel_offset.y - @pen_label_offset.y + @pen_label_height
        ctx.fillStyle = '#000'
        ctx.fillText(@pen_label, plx, ply);

  draw_tick_at: (t, size) ->
    return unless @pen?
    t_save = @t

    @t = t
    normal = @get_normal()
    if normal?
      normal = Vec2.scale(normal, 3 + (4.0 * size))

      point_a_x = @pen.position.x + normal.x
      point_a_y = @pen.position.y + normal.y

      point_b_x = @pen.position.x - normal.x
      point_b_y = @pen.position.y - normal.y

      ctx = @graph_ctx
      ctx.beginPath()
      ctx.moveTo(point_a_x, point_a_y)
      ctx.lineTo(point_b_x, point_b_y)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = if size > 3 then 2 else 1
      ctx.stroke()

    @t = t_save

  draw_ticks: ->
    @draw_tick_at(0.0,     5)
    @draw_tick_at(0.03125, 1)
    @draw_tick_at(0.0625,  2)
    @draw_tick_at(0.09375, 1)
    @draw_tick_at(0.125,   3)
    @draw_tick_at(0.15625, 1)
    @draw_tick_at(0.1875,  2)
    @draw_tick_at(0.21875, 1)
    @draw_tick_at(0.25,    4)
    @draw_tick_at(0.28125, 1)
    @draw_tick_at(0.3125,  2)
    @draw_tick_at(0.34375, 1)
    @draw_tick_at(0.375,   3)
    @draw_tick_at(0.40625, 1)
    @draw_tick_at(0.4375,  2)
    @draw_tick_at(0.46875, 1)
    @draw_tick_at(0.5,     5)
    @draw_tick_at(0.53125, 1)
    @draw_tick_at(0.5625,  2)
    @draw_tick_at(0.59375, 1)
    @draw_tick_at(0.625,   3)
    @draw_tick_at(0.65625, 1)
    @draw_tick_at(0.6875,  2)
    @draw_tick_at(0.71875, 1)
    @draw_tick_at(0.75,    4)
    @draw_tick_at(0.78125, 1)
    @draw_tick_at(0.8125,  2)
    @draw_tick_at(0.84375, 1)
    @draw_tick_at(0.875,   3)
    @draw_tick_at(0.90625, 1)
    @draw_tick_at(0.9375,  2)
    @draw_tick_at(0.96875, 1)
    @draw_tick_at(1.0,     5)

  update_and_draw: ->
    @graph_ctx.clearRect(0, 0, @graph_canvas.width, @graph_canvas.height)
    @draw_ticks() if @show_ticks_checkbox.checked
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
      @set_tslider_position(@tslider.min + (@t * @tslider.range))
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

document.addEventListener 'DOMContentLoaded', =>
  APP = new LERPingSplines(document)
  APP.init()
  APP.draw()
