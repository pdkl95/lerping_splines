APP = null


class LERPingSplines
  points: []

  constructor: (@context) ->

  init: () ->
    @running = false

    @content_el       = @context.getElementById('content')

    @graph_wrapper   = @context.getElementById('graph_wrapper')
    @graph_canvas    = @context.getElementById('graph')
    @graph_ui_canvas = @context.getElementById('graph_ui')

    @graph_ctx    = @graph_canvas.getContext('2d', alpha: true)
    @graph_ui_ctx = @graph_ui_canvas.getContext('2d', alpha: true)

    @btn_run = $('#button_run').checkboxradio(icon: false)

    #@btn_run.addEventListener 'click', @on_run

    @num_points = $('#num_points').spinner
       change: @on_num_pointa_changed

  on_num_points_changed: (event, ui) =>

  on_run: =>
    if @running
      @stop()
    else
      @start()

  redraw_ui: (render_bitmap_preview = true) =>
    @graph_ui_ctx.clearRect(0, 0, @graph_ui_canvas.width, @graph_ui_canvas.height)

    @cur?.draw_ui()

    for p in @points
      p.draw_ui()

    return null

  update: =>
    @frame_is_scheduled = false
    @multistep()
    @schedule_next_frame() if @running
    return null

  schedule_next_frame: () ->
    unless @frame_is_scheduled
      @frame_is_scheduled = true
      window.requestAnimationFrame(@update)
    return null


$(document).ready =>
  APP = new LERPingSplines(document)
  APP.init()
