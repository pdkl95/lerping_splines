window.APP = null

TAU = 2 * Math.PI

class Point
  constructor: (x, y, @color) ->
    @enabled = false

    @hover = false
    @selected = false

    @order = 0
    @radius = LERPingSplines.point_radius
    @color ?= '#000'
    @label_color ?= '#000'

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

    ###################
    # X

    @x_is_left = true

    if (@position.x > (APP.graph_width / 2.0)) and (@position.x < APP.point_label_flip_margin.max_x)
      @x_is_left = false

    if @position.x <= APP.point_label_flip_margin.min_x
      @x_is_left = false

    if @x_is_left
      @label_position.x = @position.x - @label_width - 13
    else
      @label_position.x = @position.x + @label_width - 1

    ###################
    # Y

    @y_is_top = true

    if (@position.y > (APP.graph_height / 2.0)) and (@position.y < APP.point_label_flip_margin.max_y)
      @y_is_top = false

    if @position.y <= APP.point_label_flip_margin.min_y
      @y_is_top = false

    if @y_is_top
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
      ctx.fillStyle = @label_color
      ctx.fillText(@label, @label_position.x, @label_position.y);


class LERP extends Point
  constructor: (@order, @from, @to) ->
    @enabled = false

    @radius = 5

    @color = switch @order
      when 1 then '#451C92'
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
    if APP.option.alt_algorithm_names.value
      @label
    else
      @alg_label

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

    draw_from_to_line = true

    if APP.spline_mode
      unless @from.knot or @to.knot
        draw_from_to_line = false

    if draw_from_to_line
      ctx.beginPath()
      ctx.strokeStyle = @color
      ctx.lineWidth = 1
      ctx.moveTo(@from.position.x, @from.position.y)
      ctx.lineTo(@to.position.x, @to.position.y)
      ctx.stroke()

    ctx.beginPath()
    if APP.curve.pen is this
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

  update_order_0_point_label_color: ->
    return unless APP.curve?

    rgb = Color.hex2rgb(@color);
    hsv = Color.rgb2hsv(rgb[0], rgb[1], rgb[2]);
    hsv[0] += 0.7
    hsv[0] -= 1.0 if hsv[0] > 1.0
    hsv[1] *= 0.5
    hsv[2] *= 0.55
    rgb = Color.hsv2rgb(hsv[0], hsv[1], hsv[2]);
    color = Color.rgbarr2hex(rgb)

    for p from APP.curve.each_point()
      p.label_color = color

class Curve
  constructor: ->
    @points = []
    @enabled_points = 0
    @ui_enabled = true

    @pen_label = 'P'
    @pen_label_metrics = APP.graph_ctx.measureText(@pen_label)
    @pen_label_width   = @pen_label_metrics.width
    @pen_label_height  = LERPingSplines.pen_label_height
    @pen_label_offset =
      x: @pen_label_width  / 2
      y: @pen_label_height / 2

    @pen_label_offset_length = Vec2.magnitude(@pen_label_offset)

  disable_ui: ->
    @ui_enabled = false

  min_points: ->
    @constructor.min_points

  max_points: ->
    @constructor.max_points

  each_point: (include_first = true) ->
    first = true
    for order in @points
      for p in order
        if first
          first = false
          yield p if include_first
        else
          yield p
    return

  add_lerps: ->
    for order in [1..@max_points()]
      @points[order] = []
      prev_order = order - 1
      prev = @points[prev_order]
      for j in [0..(@max_points() - order)]
        #console.log("order=#{order} j=#{j}", prev)
        break unless prev[j]? and prev[j+1]?
        lerp = new LERP( order, prev[j], prev[j+1] )
        @points[order][j] = lerp
        @points[order][j].generate_label(order, j)

  set_points: (points) ->
    for p in points
      p.enabled = true
      @enabled_points += 1

    @points[0] = points
    @add_lerps()
    @setup_pen()

  add_initial_points: (initial_points = @constructor.initial_points) ->
    margin = LERPingSplines.create_point_margin
    range = 1.0 - (2.0 * margin)

    @points[0] = []
    for i in [0..@max_points()]
      x = margin + (range * Math.random())
      y = margin + (range * Math.random())
      @points[0][i] = new Point(x * APP.graph_width, y * APP.graph_height)
      @points[0][i].set_label( LERPingSplines.point_labels[i] )

    @add_lerps()

    for point in initial_points
      @enable_point_at( point[0], point[1] )

    @update_enabled_points()

    console.log('Initial points created!')

  find_point: (x, y) ->
    for p from @each_point()
      if p?.contains(x, y)
        return p
    return null

  setup_pen: ->
    p = null
    for i in [(@max_points() - 1)..1]
      p = @points[i][0]
      if p?.enabled
        break
    if p?
      @pen = p
      @pen.update_order_0_point_label_color()
    else
      APP.debug("ERROR: no pen?!")

  update_enabled_points: ->
    if @ui_enabled
      if @enabled_points < @max_points()
        APP.add_point_btn.disabled = false
      else
        APP.add_point_btn.disabled = true

      if @enabled_points > @min_points()
        APP.remove_point_btn.disabled = false
      else
        APP.remove_point_btn.disabled = true

      APP.num_points.textContent = "#{@enabled_points}"

    @update()
    @setup_pen()
    APP.update_algorithm()

  order_up_rebalance: ->

  enable_point: (rebalance_points) ->
    return if @enabled_points >= @max_points()
    p = @points[0][@enabled_points]

    if rebalance_points and APP.option.rebalance_points_on_order_up.value
      @order_up_rebalance()

    p.enabled = true
    @enabled_points += 1
    @update_enabled_points()
    p

  enable_point_at: (x, y) ->
    p = @enable_point(false)
    p.x = x * APP.graph_width
    p.y = y * APP.graph_height
    p

  compute_lower_order_curve: ->

  disable_point: ->
    return if @enabled_points <= @min_points()

    if @enabled_points > 3 and APP.option.rebalance_points_on_order_down.value
      @compute_lower_order_curve()

    @enabled_points -= 1
    p = @points[0][@enabled_points]
    p.enabled = false
    @update_enabled_points()

  update_at: (t) =>
    for order in @points
      for p in order
        p.update(t)

  update: ->
    @update_at(APP.t)

  find_pen: ->
    for i in [(@max_points() - 1)..1]
      p = @points[i][0]
      if p?.enabled
        break

    APP.debug("missing pen") unless p
    p

  draw_curve: ->
    return unless @points? and @points[0]?

    start = @points[0][0]

    p = @find_pen()

    ctx = APP.graph_ctx
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
    return unless @points? and @points[0]?

    for order in @points
      for p in order
        if p.order > 1
          p.draw()
    for p in @points[1]
      p.draw()
    for p in @points[0]
      p.draw()

  get_normal: ->
    @update_at(APP.t - APP.t_step)
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

      ctx = APP.graph_ctx
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

      plabel_offset = Vec2.scale(Vec2.normalize(arrow_shaft), @pen_label_offset_length + 3)
      plx = arrowtip.x + arrow_shaft.x + plabel_offset.x - @pen_label_offset.x
      ply = arrowtip.y + arrow_shaft.y + plabel_offset.y - @pen_label_offset.y + @pen_label_height
      ctx.fillStyle = '#000'
      ctx.fillText(@pen_label, plx, ply);

  draw_tick_at: (t, size) ->
    return unless @pen?
    t_save = APP.t

    APP.t = t
    normal = @get_normal()
    if normal?
      normal = Vec2.scale(normal, 3 + (4.0 * size))

      point_a_x = @pen.position.x + normal.x
      point_a_y = @pen.position.y + normal.y

      point_b_x = @pen.position.x - normal.x
      point_b_y = @pen.position.y - normal.y

      ctx = APP.graph_ctx
      ctx.beginPath()
      ctx.moveTo(point_a_x, point_a_y)
      ctx.lineTo(point_b_x, point_b_y)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = if size > 3 then 2 else 1
      ctx.stroke()

    APP.t = t_save

  draw_ticks: ->
    @pen = @find_pen()

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


class Bezier extends Curve
  @min_points: 3
  @max_points: 8

  @initial_points: [
    [ 0.06, 0.82 ],
    [ 0.72, 0.18 ]
  ]

  t_min: ->
    0.0

  t_max: ->
    1.0

  order_up_rebalance: ->
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
      p = APP.clamp_to_canvas(points[i])
      @points[0][i].move(p.x, p.y)

  get_algorithm_text: ->
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

        if APP.option.alt_algorithm_names.value
          # alt
          switch order
            when 0
              lines.push "#{label} = <#{parseInt(p.position.x, 10)}, #{parseInt(p.position.y, 10)}>"

            when 6
              if label.length < 4
                lines.push "#{label} = Lerp(#{p.from.get_label()}, #{p.to.get_label()}, t)"

              else
                lines.push "#{label} ="
                lines.push "    Lerp(#{p.from.get_label()},"
                lines.push "         #{p.to.get_label()}, t)"

            when 7
              if label.length < 4
                lines.push "#{label} = Lerp(#{p.from.get_label()},"
              else
                lines.push "#{label} ="
                lines.push "    Lerp(#{p.from.get_label()},"

              lines.push "         #{p.to.get_label()},"
              lines.push "         t)"

            else
              lines.push "#{label} = Lerp(#{p.from.get_label()}, #{p.to.get_label()}, t)"

        else
          # normal
          if order > 0
            lines.push "#{label} = Lerp(#{p.from.get_label()}, #{p.to.get_label()}, t)"
          else
            lines.push "#{label} = <#{parseInt(p.position.x, 10)}, #{parseInt(p.position.y, 10)}>"

    lines.join("\n")

class Spline extends Curve
  @min_order: 1
  @max_order: 3
  @min_segments: 1
  @max_segments: 4

  @initial_points: [
    [ 0.06, 0.82 ],
    [ 0.15, 0.08 ],
    [ 0.72, 0.18 ],
    [ 0.88, 0.90 ]
  ]

  constructor: ->
    super

    @segment_count = 0
    @segment = []
    @order = 3

  log: ->
    console.log("/// Spline State: order=#{@order} segment_count=#{@segment_count}")
    console.log("                  points.length=#{@points.length} segment.length=#{@segment.length}")
    console.log('points')
    console.log(@points)
    console.log('segments')
    console.log(@segment)
    console.log("\\\\\\ Spline State End")

  t_min: ->
    0.0

  t_max: ->
    @segment_count - 1

  set_t_segment: (value) ->
    @t_segment = value

  current_segment: ->
    if APP.t_real == @t_max()
      @segment[@t_segment-1]
    else
      @segment[@t_segment]

  min_points: ->
    @min_order() + 1

  max_points: ->
    (@max_order() * @max_segments()) + 1

  current_max_points: ->
    (@order * @segment_count) + 1

  min_segments: ->
    @constructor.min_segments

  max_segments: ->
    @constructor.max_segments

  min_order: ->
    @constructor.min_order

  max_order: ->
    @constructor.max_order

  add_order: ->
    if @order < @max_order
      @order += 1
      @rebuild_spline()

  sub_order: ->
    if @order > @min_order
      @order -= 1
      @rebuild_spline()

  add_segment: ->
    if @segment_count < @max_segments()
      @segment_count += 1
      @rebuild_spline()

  sub_segment: ->
    if @segment_count > @min_segments()
      @segment_count -= 1
      @segment[@segment_count].enabled = false
      @rebuild_spline()

  add_initial_points: (initial_points = @constructor.initial_points) ->
    margin = LERPingSplines.create_point_margin
    range = 1.0 - (2.0 * margin)
    @points[0] = []
    prev = null
    for i in [0..@max_points()]
      x = margin + (range * Math.random())
      y = margin + (range * Math.random())
      @points[i] = new Point(x * APP.graph_width, y * APP.graph_height)
      #@points[i].set_label( LERPingSplines.point_labels[i] )
      if prev?
        prev.next = @points[i]
        @points[i].prev = prev
      prev = @points[i]

    #@log()
    @rebuild_spline(initial_points)
    @log()

    console.log('Initial points & segments created!')

  joining_points_for_order: (order) ->
    n = 0
    points = []
    for p in @each_point()
      if n < 2
        points.push(p.position)
        n = order
      n--

  rebuild_spline: (initial_points = null) ->
    margin = LERPingSplines.create_point_margin
    range = 1.0 - (2.0 * margin)

    unless initial_points?
      initial_points = @joining_points_for_order(@order)
      console.log('initial_points', initial_points)

    for point, index in initial_points
      pidx = index * @order
      #console.log(">>pidx=#{pidx} label=\"#{LERPingSplines.point_labels[index]}\"")
      @points[pidx].enabled = true
      @points[pidx].x = (margin + (range * point[0])) * APP.graph_width
      @points[pidx].y = (margin + (range * point[1])) * APP.graph_height
      @points[pidx].set_label( LERPingSplines.point_labels[index] )
      @points[pidx].knot = true
      @segment_count += 1

      if index > 0
        for j in [1..(@order-1)]
          cidx = pidx - @order + j
          prev = @points[pidx - @order]
          next = @points[pidx]
          pos = Vec2.lerp(prev, next, j / @order)
          @points[cidx].enabled = true
          @points[cidx].x = pos.x
          @points[cidx].y = pos.y
          label = "#{prev.label}#{next.label}#{j}"
          @points[cidx].set_label( label )
          @points[cidx].knot = false
          #console.log("  cidx=#{cidx} label=\"#{label}\"")

    #console.log("rebuilding spline with up to #{@max_segments()} segmente")
    for i in [0..@max_segments()]
      start_idx = (i * @order)
      end_idx = start_idx + @order + 1
      break if end_idx >= @current_max_points()
      #console.log("giving segment #{i} points #{start_idx} -> #{end_idx - 1}")
      seg_points = @points.slice(start_idx, end_idx)
      #console.log("  -> [ #{seg_points.map( (x) -> "\"#{x.label}\"" ).join(', ')} ]")
      @segment[i] = new Bezier()
      @segment[i].disable_ui()
      @segment[i].set_points( seg_points )
      @segment[i].enabled = true;
      for p in seg_points
        unless p.enabled
          @segment[i].enabled = false;
          break

    @mirror_knot_neighbors()

  mirror_knot_neighbors: ->
    for p from @each_knot()
      continue unless p.prev? and p.next? and p.prev.enabled and p.next.enabled

      delta = Vec2.sub(p.next, p)
      new_prev = Vec2.sub(p, delta)
      avg_prev = Vec2.lerp(p.prev, new_prev, 0.5)
      p.prev.x = avg_prev.x
      p.prev.y = avg_prev.y

      delta = Vec2.sub(p.prev, p)
      p.next.x = p.x - delta.x
      p.next.y = p.y - delta.y

  each_knot: ->
    return unless @segment?
    first = true
    for s in @segment
      for p from s.each_point(first)
        yield p if p.knot
      first = false

  each_point: ->
    return unless @segment?
    first = true
    for s in @segment
      for p from s.each_point(first)
        yield p
      first = false

  find_point: (x, y) ->
    for s in @segment
      p = s.find_point(x, y)
      return p if p?
    return null

  call_on_each_segment: (func_name) ->
    for s in @segment
      if s?.enabled
        s.pen = s.find_pen()
        @pen = s.pen
        s[func_name]()

  update: ->
    @call_on_each_segment('update')

  draw_curve: ->
    @call_on_each_segment('draw_curve')

  draw_ticks: ->
    @call_on_each_segment('draw_ticks')

  draw_pen: ->
    s = @current_segment()
    if s?
      s.draw_pen()

  draw: ->
    @call_on_each_segment('draw')

  get_algorithm_text: ->
    ''

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

    @algorithmbox   = @find_element('algorithmbox')
    @algorithm_text = @find_element('algorithm_text')

    @bezier_curve.add_initial_points()
    @spline_curve.add_initial_points()

    @option.mode.change()

    @reset_loop()

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

    @update_and_draw()

  configure_for_spline_mode: ->
    console.log("configure for mode: spline")
    @bezier_mode = false
    @spline_mode = true
    @curve = @spline_curve

    @order_wrapper.classList.remove('hidden')

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
            if p.prev
              p.prev.x += dx
              p.prev.y += dy
            if p.next
              p.next.x += dx
              p.next.y += dy
          else
            if p.prev.knot
              p.prev.prev.x -= dx
              p.prev.prev.y -= dy
            else if p.next.knot
              p.next.next.x -= dx
              p.next.next.y -= dy

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
