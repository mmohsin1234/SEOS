/**
 * content.js
 * Scrapes the DOM for SEO related information and returns it to the popup.
 */

(function() {
  const getPageData = () => {
    // Title
    const title = document.title || "";
    const titleLength = title.length;

    // Meta Description
    const metaDescTag = document.querySelector('meta[name="description"]');
    const metaDescription = metaDescTag ? metaDescTag.getAttribute("content") : "";
    const metaDescriptionLength = metaDescription.length;

    // Headers
    const h1s = Array.from(document.querySelectorAll("h1")).map(el => el.innerText.trim());
    const h2s = Array.from(document.querySelectorAll("h2")).map(el => el.innerText.trim());
    const h3s = Array.from(document.querySelectorAll("h3")).map(el => el.innerText.trim());

    // Images missing alt text
    const images = Array.from(document.querySelectorAll("img"));
    const missingAltImages = images
      .filter(img => !img.hasAttribute("alt") || img.getAttribute("alt").trim() === "")
      .map(img => img.src.substring(0, 50) + (img.src.length > 50 ? "..." : ""));

    // Canonical
    const canonicalTag = document.querySelector('link[rel="canonical"]');
    const canonicalUrl = canonicalTag ? canonicalTag.getAttribute("href") : null;

    // Links
    const links = Array.from(document.querySelectorAll("a"));
    const currentHost = window.location.hostname;
    let internalCount = 0;
    let externalCount = 0;

    links.forEach(link => {
      try {
        const url = new URL(link.href);
        if (url.hostname === currentHost || url.protocol === "javascript:") {
          internalCount++;
        } else {
          externalCount++;
        }
      } catch (e) {
        // Relative or invalid URLs are usually internal
        internalCount++;
      }
    });

    // Word Count
    const bodyText = document.body.innerText || "";
    const wordCount = bodyText.split(/\s+/).filter(word => word.length > 0).length;

    return {
      title,
      titleLength,
      metaDescription,
      metaDescriptionLength,
      h1s,
      h2s,
      h3s,
      missingAltImages,
      canonicalUrl,
      internalCount,
      externalCount,
      wordCount,
      url: window.location.href
    };
  };

  return getPageData();
})();
