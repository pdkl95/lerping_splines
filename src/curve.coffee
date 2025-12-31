##############################################################################
#                                                                            #
#  curve.coffee                                                              #
#                                                                            #
#  This file is part of lerping_splines.                                     #
#                                                                            #
#  lerping_splines is free software: you can redistribute it and/or          #
#  modify it under the terms of the GNU General Public License as published  #
#  by the Free Software Foundation, either version 3 of the License,         #
#  or (at your option) any later version.                                    #
#                                                                            #
#  lerping_splines is distributed in the hope that it will be useful,        #
#  but WITHOUT ANY WARRANTY; without even the implied warranty of            #
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General  #
#  Public License for more details.                                          #
#                                                                            #
#  You should have received a copy of the GNU General Public License along   #
#  with lerping_splines. If not, see <https://www.gnu.org/licenses/>.        #
#                                                                            #
##############################################################################

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

  reset: ->
    @reset_points()

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

    @first_point = @points[0][0]
    @last_point = @points[0][ @points[0].length - 1 ]

    @add_lerps()
    @setup_label()
    @setup_pen()

  reset_points: ->
    for p from @each_point()
      p.reset()

  find_point: (x, y) ->
    for p from @each_point()
      if p?.contains(x, y)
        return p
    return null

  setup_pen: ->
    @pen = @find_pen()

  setup_label: ->
    @label = "#{@first_point.label}~#{@last_point.label}"

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

    @first_point = @points[0][0]
    i = @points[0].length - 1
    i-- while i > 0 and !@points[0][i].enabled
    @last_point = @points[0][i]

    @setup_label()
    @setup_pen()
    APP.update_algorithm()

  order_up_rebalance: ->

  enable_point: (rebalance_points) ->
    return if @enabled_points >= @max_points()
    p = @points[0][@enabled_points]

    if rebalance_points and APP.option.rebalance_points_on_order_up.value and APP.bezier_mode
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

    if @enabled_points > 3 and APP.option.rebalance_points_on_order_down.value and APP.bezier_mode
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

  constructor: ->
    super
    @alloc_points()

  t_min: ->
    0.0

  t_max: ->
    1.0

  add_segment: ->
    APP.assert_never_reached()

  sub_segment: ->
    APP.assert_never_reached()

  alloc_points: ->
    @points[0] = []

    for i in [0..@max_points()]
      @points[0][i] = new Point()
      @points[0][i].set_label( LERPingSplines.point_labels[i] )

    @add_lerps()

  build: ->
    @reset()

    initial_points = @constructor.initial_points
    margin = LERPingSplines.create_point_margin
    range = 1.0 - (2.0 * margin)

    @reset_points()

    for point in initial_points
      @enable_point_at( point[0], point[1] )

    @update_enabled_points()

    console.log('Initial points created!')

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
    [ 0.88, 0.90 ],
    [ 0.43, 0.84 ]
  ]

  constructor: ->
    super

    @order = -1
    @segment_count = -1

    @segment = []

    @alloc_points()

  log: ->
    console.log("/// Spline State: order=#{@order} segment_count=#{@segment_count}")
    console.log("                  points.length=#{@points.length} segment.length=#{@segment.length}")
    console.log('points')
    console.log(@points)
    console.log('segments')
    console.log(@segment)
    console.log("\\\\\\ Spline State End")

  reset: ->
    super
    @order = -1
    @segment_count = -1
    @segment = []

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

  enable_point: (rebalance_points) ->
    APP.assert_never_reached()

  disable_point: (rebalance_points) ->
    APP.assert_never_reached()

  alloc_points: () ->
    @points[0] = []
    prev = null
    for i in [0..@max_points()]
      @points[i] = new Point()
      #@points[i].set_label( LERPingSplines.point_labels[i] )
      if prev?
        prev.next = @points[i]
        @points[i].prev = prev
      prev = @points[i]

  joining_points_for_order: (order) ->
    n = 0
    points = []
    for p in @each_point()
      if n < 2
        points.push(p.position)
        n = order
      n--

  build: (order, sc) ->
    @reset()

    @order = order
    @segment_count = sc

    initial_points = @constructor.initial_points

    unless initial_points?
      initial_points = @joining_points_for_order(@order)
      console.log('initial_points', initial_points)

    @enabled_points = 0
    unless @min_segments() <= @segment_count <= @max_segments()
      APP.fatal_error("bad @segment_count value: #{@segment_count}")
    for index in [0..@segment_count]
      point = initial_points[index]
      pidx = index * @order
      #console.log(">>pidx=#{pidx} label=\"#{LERPingSplines.point_labels[index]}\"")
      @points[pidx].enabled = true
      @enabled_points += 1
      @points[pidx].set_fract_position(point[0], point[1])
      @points[pidx].set_label( LERPingSplines.point_labels[index] )
      @points[pidx].knot = true

      if index > 0
        for j in [1..(@order-1)]
          cidx = pidx - @order + j
          prev = @points[pidx - @order]
          next = @points[pidx]
          pos = Vec2.lerp(prev, next, j / @order)
          @points[cidx].enabled = true
          @enabled_points += 1
          @points[cidx].x = pos.x
          @points[cidx].y = pos.y
          label = "#{prev.label}#{next.label}#{j}"
          @points[cidx].set_label( label )
          @points[cidx].show_label = false
          #console.log("  cidx=#{cidx} label=\"#{label}\"")
          @points[cidx].knot = false

    #console.log("rebuilding spline with up to #{@max_segments()} segmente")
    @enabled_segments = 0
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

      if @segment[i].enabled
        @enabled_segments += 1

    @expected_points  = 1                # starting knot
    @expected_points += @segment_count   # knot at the end of each segment
    @expected_points += @segment_count * (@order - 1)  # control points between knots

    if @expected_points != @enabled_points
      APP.fatal_error("Wrong number of enabled points! Expected #{@expected_points}, have enabled #{@enabled_points} (order=#{@order} segment_count=#{@segment_count}")

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
    s = @current_segment()
    @pen = s.pen if s?

    for s in @segment
      if s?.enabled
        s[func_name]()

  update_at: (t) =>
    s = @current_segment()
    if s?
      s.update_at(t)

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
