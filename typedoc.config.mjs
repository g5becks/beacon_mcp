/** @type {Partial<import("typedoc").TypeDocOptions>} */
const config = {
  entryPoints: ["./src/*"],
  out: "doc",
  plugin: "typedoc-plugin-markdown",
};

export default config;
