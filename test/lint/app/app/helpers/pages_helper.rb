module PagesHelper
  def ok_button = ui(:button, content: "Save")
  def bare_button = tag.button("Save", type: "button")
  def bare_box = check_box_tag(:done)
  def wrapped_select = select_control(select_tag(:kind, "<option>a</option>"))
  def old_button = link_to("Save", "/", class: "btn")
  # runeui:allow native-control — kept for a plugin
  def kept_box = check_box_tag(:kept)
  def trigger = tag.button("History", data: { slot: "collapsible-trigger" })
end
