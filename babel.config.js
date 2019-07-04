module.exports = function (api) {
  api.cache(true);

  const plugins = ["@babel/plugin-syntax-dynamic-import"];
  const presets = ["@babel/preset-env"] ;

  return {
    presets,
    plugins
  };
}