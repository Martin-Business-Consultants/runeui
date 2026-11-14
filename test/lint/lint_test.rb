# runeui's lint against a made-up app (test/lint/app): every offense it should find, and none it
# shouldn't. Runs the Ruby checks directly and the Herb rule through herb lint (Node), as an app
# does. script/test runs it; on its own: ruby test/lint/lint_test.rb
require "minitest/autorun"
require "json"
require "open3"
require "set"
require "tmpdir"
require "fileutils"
require_relative "../../lib/runeui/lint"

class RuneuiLintTest < Minitest::Test
  APP = File.expand_path("app", __dir__)
  GEMFILE = File.expand_path("../../Gemfile", __dir__)

  def lint = @lint ||= Runeui::Lint.new(root: APP)

  def found(path)
    lint.run.select { it.path == path }.map { [ it.line, it.rule ] }.sort
  end

  def test_stylesheets
    assert_equal [
      [ 3, "unknown-token" ],          # --text-muted: an old kit's name
      [ 4, "hard-coded-colour" ],      # #fff in a property
      [ 5, "colour-mix" ],             # in srgb
      [ 6, "hard-coded-colour" ],      # rgb() in a shadow
      [ 8, "hard-coded-colour" ],      # white
      [ 11, "hard-coded-colour" ],     # runeui:allow without a reason
      [ 12, "hard-coded-colour" ]      # …so the line under it isn't allowed
    ], found("app/assets/stylesheets/app.css")
  end

  def test_helpers
    assert_equal [
      [ 3, "native-control" ],         # tag.button
      [ 4, "native-control" ],         # check_box_tag
      [ 6, "denied-class" ]            # class: "btn"
    ], found("app/helpers/pages_helper.rb")
  end

  def test_javascript_and_views_classes
    assert_equal [ [ 1, "denied-class" ], [ 2, "denied-class" ] ], found("app/javascript/app.js")
    assert_equal [ [ 25, "denied-class" ] ], found("app/views/pages/show.html.erb")
  end

  def test_herb_rule
    Dir.mktmpdir do |dir|
      FileUtils.cp_r "#{APP}/.", dir
      Runeui::Lint.new(root: dir).install_herb_rule
      output, status = Open3.capture2e({ "BUNDLE_GEMFILE" => GEMFILE, "NO_COLOR" => "1" },
        "bundle", "exec", "herb", "lint", "app/views", "--only", "runeui-native-controls", "--json", chdir: dir)
      json = JSON.parse(output[output.index("{")..]) rescue flunk("herb lint gave no JSON (exit #{status.exitstatus}):\n#{output}")
      lines = json.fetch("offenses").map { [ File.basename(it["filename"]), it.dig("location", "start", "line") ] }.sort

      assert_equal [ 2, 4, 6, 7, 8, 9, 10, 12, 16, 22, 23 ].map { [ "show.html.erb", it ] }, lines
    end
  end
end
