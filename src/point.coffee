##############################################################################
#                                                                            #
#  point.coffee                                                              #
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

class Point
  constructor: (@color) ->
    @reset()

    @order = 0
    @radius = LERPingSplines.point_radius
    @color ?= '#000'
    @label_color ?= '#000'
    @show_label = true

    @set_random_position()

    @position =
      x: @x
      y: @y

    @label_position =
      x: @x
      y: @y

  reset: ->
    @enabled = false;
    @hover = false
    @selected = false

  set_label: (@label) ->
    @label_metrics = APP.graph_ctx.measureText(@label)
    @label_width   = @label_metrics.width
    @label_height  = LERPingSplines.point_label_height

  get_label: ->
    @label

  set_random_position: ->
    @set_fract_position(Math.random(), Math.random())

  set_fract_position: (x, y) ->
    margin = LERPingSplines.create_point_margin
    range = 1.0 - (2.0 * margin)

    x = margin + (range * x)
    y = margin + (range * y)

    @move(x * APP.graph_width, y * APP.graph_height)

  move: (x, y) ->
    @x = x
    @y = y

  contains: (x, y) ->
    dx = @x - x
    dy = @y - y
    dist = Math.sqrt((dx * dx) + (dy * dy))
    return dist <= @radius + LERPingSplines.mouseover_point_radius_boost

  mirror_around_prev_knot: ->
    delta = Vec2.sub(@prev, @prev.prev)
    newpos = Vec2.add(@prev, delta)
    @x = newpos.x
    @y = newpos.y

  mirror_around_next_knot: ->
    delta = Vec2.sub(@next, @next.next)
    newpos = Vec2.add(@next, delta)
    @x = newpos.x
    @y = newpos.y


  mirror_around_knot: ->
    if @prev? and @prev.prev? and @prev.knot
      @mirror_around_prev_knot()
    else if @next? and @next.next? and @next.knot
      @mirror_around_next_knot()

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

    radius = @radius = 5
    inner_radius = radius * 0.8

    if @hover
      ctx.beginPath()
      ctx.fillStyle = '#ff0'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.arc(@x, @y, radius * 3, 0, TAU)
      ctx.fill()
      ctx.stroke()
      radius *= 1.5
      inner_radius = @radius * 0.7

    ctx.beginPath()

    if APP.spline_mode && !@knot
      ctx.arc(@x, @y, inner_radius, 0, TAU, true)

    ctx.arc(@x, @y, radius, 0, TAU)

    ctx.fillStyle = @color
    ctx.fill()

    if @label && @show_label
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

    # if APP.spline_mode
    #   unless @from.knot or @to.knot
    #     draw_from_to_line = false

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

