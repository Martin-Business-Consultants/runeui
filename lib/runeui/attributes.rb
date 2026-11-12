module Runeui
  # Merges a component's own attributes with what the caller passed, the way shadcn merges class
  # names: classes join, data and aria hashes merge (data-action and data-controller join, so a
  # caller's Stimulus wiring adds to the component's), anything else the caller gives wins.
  module Attributes
    JOINED = %i[class].freeze
    JOINED_DATA = %i[action controller].freeze

    module_function

    def merge(base, extra)
      result = base.dup
      extra.each do |key, value|
        key = key.to_sym
        case key
        when :class
          result[:class] = [ result[:class], value ].flatten.compact_blank.join(" ").presence
        when :data, :aria
          result[key] = merge_nested(result[key] || {}, value || {}, key == :data)
        else
          result[key] = value
        end
      end
      result.compact
    end

    def merge_nested(base, extra, data)
      result = base.transform_keys(&:to_sym)
      extra.each do |key, value|
        key = key.to_sym
        result[key] = data && JOINED_DATA.include?(key) && result[key] ? "#{result[key]} #{value}" : value
      end
      result
    end
  end
end
