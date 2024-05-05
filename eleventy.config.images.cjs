const path = require("path");
const eleventyImage = require("@11ty/eleventy-img");

function relativeToInputPath(inputPath, relativeFilePath) {
  let split = inputPath.split("/");
  split.pop();

  return path.resolve(split.join(path.sep), relativeFilePath);
}

function isFullUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(eleventyImage.eleventyImageTransformPlugin, {
    // which file extensions to process
    extensions: "html,css",

    // Add any other Image utility options here:

    // optional, output image formats
    formats: ["webp", "jpeg"],
    // formats: ["auto"],

    // optional, output image widths
    widths: ["auto"],

    // optional, attributes assigned on <img> override these values.
    defaultAttributes: {
      loading: "lazy",
      decoding: "async",
    },
  });

  eleventyConfig.addAsyncFilter("image", async function imageFilter(src) {
    let input;
    if (isFullUrl(src)) {
      input = src;
    } else {
      input = relativeToInputPath(this.page.inputPath, src);
    }

    let metadata = await eleventyImage(input, {
      widths: ["auto"],
      formats: ["auto"],
      outputDir: path.join(eleventyConfig.dir.output, "img"),
    });

    let imageAttributes = {
      alt: "",
      loading: "lazy",
      decoding: "async",
    };

    const obj = eleventyImage.generateObject(metadata, imageAttributes);
    return obj.img.src;
  });

  // Eleventy Image shortcode
  // https://www.11ty.dev/docs/plugins/image/
  eleventyConfig.addAsyncShortcode("image", async function imageShortcode(src, alt, widths, sizes) {
    // Full list of formats here: https://www.11ty.dev/docs/plugins/image/#output-formats
    // Warning: Avif can be resource-intensive so take care!
    let formats = ["webp", "auto"];
    let input;
    if (isFullUrl(src)) {
      input = src;
    } else {
      input = relativeToInputPath(this.page.inputPath, src);
    }

    let metadata = await eleventyImage(input, {
      widths: widths || ["auto"],
      formats,
      outputDir: path.join(eleventyConfig.dir.output, "img"), // Advanced usage note: `eleventyConfig.dir` works here because we’re using addPlugin.
    });

    // TODO loading=eager and fetchpriority=high
    let imageAttributes = {
      alt,
      sizes,
      loading: "lazy",
      decoding: "async",
    };

    return eleventyImage.generateHTML(metadata, imageAttributes);
  });
};
