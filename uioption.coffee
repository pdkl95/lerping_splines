window.UI or= {}
class UI.Option
  @create_input_element: (type = null, id = null) ->
    el = window.APP.context.createElement('input')
    el.id = id if id?
    el.type = type if type?
    el

  constructor: (@id, default_value = null, @callback = {}) ->
    if @id instanceof Element
      @el = @id
      @id = @el.id
    else
      @el = window.APP.context.getElementById(@id)
      unless @el?
        console.log("ERROR - could not find element with id=\"#{@id}\"")

    @persist = true
    @storage_id = "ui_option-#{@id}"
    @label_id = "#{@id}_label"
    @label_el = window.APP.context.getElementById(@label_id)

    @label_text_formater = @default_label_text_formater

    if default_value?
      @default = default_value
    else
      @default = @detect_default_value()

    stored_value = APP.storage_get(@storage_id)
    if stored_value?
      @set(stored_value)
    else
      @set(@default)

    @setup_listeners()

  setup_listeners: ->
    @el.addEventListener('change', @on_change)
    @el.addEventListener('input',  @on_input)

  detect_default_value: ->
    @get()

  reset: ->
    APP.storage_remove(@storage_id)
    @set(@default)

  register_callback: (opt = {}) ->
    for name, func of opt
      @callback[name] = func

    for key, func of @callback
      delete @callback[name] unless func?

  set_value: (new_value = null) ->
    @value = new_value if new_value?
    @label_el.innerText = @label_text() if @label_el?

    if @persist
      APP.storage_set(@storage_id, @value, @default)
 
  default_label_text_formater: (value) ->
    "#{value}"

  label_text: ->
    @label_text_formater(@value)

  set_label_text_formater: (func) ->
    @label_text_formater = func
    @set_value()

  on_change: (event) =>
    @set(@get(event.target), false)
    @callback.on_change?(@value)

  on_input: (event) =>
    @set(@get(event.target), false)
    @callback.on_input?(@value)

  enable: ->
    @el.disabled = false

  disable: ->
    @el.disabled = true

  destroy: ->
    @el.remove() if @el?
    @el = null

class UI.BoolOption extends UI.Option
  @create: (parent, @id, rest...) ->
    opt = new UI.BoolOption(UIOption.create_input_element('checkbox', @id), rest...)
    parent.appendChild(opt.el)
    opt

  get: (element = @el) ->
    element.checked

  set: (bool_value, update_element = true) ->
    oldvalue = @value
    newvalue = switch bool_value
      when 'true'  then true
      when 'false' then false
      else
        !!bool_value
    @el.checked = newvalue if update_element

    @set_value(newvalue)
    if oldvalue != newvalue
      if newvalue
        @callback.on_true?()
      else
        @callback.on_false?()

class UI.IntOption extends UI.Option
  @create: (parent, @id, rest...) ->
    opt = new UI.IntOption(UIOption.create_input_element('number', @id), rest...)
    parent.appendChild(opt.el)
    opt

  get: (element = @el) ->
    parseInt(element.value)

  set: (number_value, update_element = true) ->
    @set_value(parseInt(number_value))
    @el.value = @value if update_element

class UI.FloatOption extends UI.Option
  @create: (parent, @id, rest...) ->
    opt = new UI.IntOption(UIOption.create_input_element(null, @id), rest...)
    parent.appendChild(opt.el)
    opt

  get: (element = @el) ->
    parseFloat(element.value)

  set: (number_value, update_element = true) ->
    @set_value(parseFloat(number_value))
    @el.value = @value if update_element

class UI.PercentOption extends UI.FloatOption
  label_text: ->
    perc = parseInt(@value * 100)
    "#{perc}%"

class UI.SelectOption extends UI.Option
  setup_listeners: ->
    @el.addEventListener('change', @on_change)
    # skip input event

  get: (element = @el) ->
    opt = element.options[element.selectedIndex]
    if opt?
      opt.value
    else
      null

  set: (option_name, update_element = true) ->
    opt = @option_with_name(option_name)
    if opt?
      @set_value(opt.value)
      opt.selected = true if update_element

  values: ->
    @el.options.map( (x) -> x.name )

  option_with_name: (name) ->
    for opt in @el.options
      if opt.value is name
        return opt
    return null

  add_option: (value, text, selected=false) ->
    opt = document.createElement('option')
    opt.value = value
    opt.text = text
    @el.add(opt, null)
    opt.selected = true if selected
    @set(@get())

class UI.ColorOption extends UI.Option
  get: (element = @el) ->
    element.value

  set: (new_value, update_element = true) ->
    @set_value(new_value)
    @el.value = new_value if update_element
    @color
