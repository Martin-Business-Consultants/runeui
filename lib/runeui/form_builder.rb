module Runeui
  # Components as form fields, named and filled from the form's object like Rails' own:
  #
  #   <%= form_with model: @project do |form| %>
  #     <%= form.ui :input, :name %>
  #     <%= form.ui :select, :status, options: Project::STATUSES %>
  #     <%= form.ui :switch, :public, label: "Anyone can see it" %>
  #     <%= form.ui :field, :name, label: "Name", description: "Shown on invoices" do %>
  #       <%= form.ui :input, :name %>
  #     <% end %>
  #   <% end %>
  #
  # Each passes the component name:, id:, value: (or checked: for the on/off ones) and invalid:
  # when the attribute has errors, plus errors: for a field; anything given wins.
  module FormBuilder
    BOOLEAN = %w[checkbox switch toggle].freeze
    # A file field has no value to show again.
    VALUELESS = %w[file_input].freeze

    def ui(component, method = nil, **locals, &block)
      return @template.ui(component, **locals, &block) unless method

      component = component.to_s
      defaults = { id: field_id(method), invalid: (object.respond_to?(:errors) && object.errors.include?(method)) || nil }
      if component == "field"
        defaults[:errors] = object.respond_to?(:errors) ? object.errors.full_messages_for(method) : []
        defaults[:control_id] = field_id(method) if locals[:control]
        defaults.delete(:id)
      elsif BOOLEAN.include?(component)
        defaults[:name] = field_name(method)
        defaults[:checked] = ActiveModel::Type::Boolean.new.cast(value_of(method)) || false
        defaults[:unchecked_value] = "0"
      else
        defaults[:name] = field_name(method, multiple: locals[:multiple].present?)
        defaults[:value] = value_of(method) unless VALUELESS.include?(component)
      end
      @template.ui(component, **defaults.compact, **locals, &block)
    end

    private
      def value_of(method)
        return unless object
        object.public_send(method) if object.respond_to?(method)
      end
  end
end
