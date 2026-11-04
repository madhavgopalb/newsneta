(function initNewsNetaBrand(global) {
  "use strict";

  const version = "v1";
  const root = `/assets/brand/${version}`;
  const assets = Object.freeze({
    source: `${root}/newsneta-official-source.jpg`,
    desktopWordmark: `${root}/wordmark-desktop.png`,
    mobileWordmark: `${root}/wordmark-mobile.png`,
    compactIcon: "/assets/app/icon-192.png?v=brand-v1",
    favicon32: `${root}/favicon-32.png`,
    favicon48: `${root}/favicon-48.png`,
    appleTouchIcon: `${root}/apple-touch-icon-180.png`,
    socialShare: `${root}/social-share-1200x630.png`,
    splash: `${root}/splash-1242x2688.png`,
    emailHeader: `${root}/email-header.png`
  });

  const tokens = Object.freeze({
    primary: "#CE0203",
    primaryDark: "#A60002",
    text: "#171717",
    background: "#F7F7F8",
    border: "#E2E4E8"
  });

  function assetForVariant(variant) {
    if (variant === "mobile" || variant === "footer" || variant === "newsroom") return assets.mobileWordmark;
    if (variant === "icon") return assets.compactIcon;
    if (variant === "email") return assets.emailHeader;
    if (variant === "loading") return assets.mobileWordmark;
    return assets.desktopWordmark;
  }

  function BrandLogo(options = {}) {
    const variant = options.variant || "desktop";
    const className = options.className ? ` ${options.className}` : "";
    const alt = options.alt || "NewsNeta official logo";
    return `<img class="newsneta-brand-logo newsneta-brand-logo--${variant}${className}" src="${assetForVariant(variant)}" alt="${alt}" width="${variant === "desktop" ? 1280 : 720}" height="${variant === "desktop" ? 552 : 310}" decoding="async">`;
  }

  const components = Object.freeze({
    BrandLogo,
    SiteHeader: options => BrandLogo({ ...options, variant: "desktop" }),
    MobileHeader: options => BrandLogo({ ...options, variant: "mobile" }),
    NewsroomHeader: options => BrandLogo({ ...options, variant: "newsroom" }),
    AppIcon: options => BrandLogo({ ...options, variant: "icon" }),
    EmailHeader: options => BrandLogo({ ...options, variant: "email" }),
    FooterBrand: options => BrandLogo({ ...options, variant: "footer" }),
    LoadingBrand: options => BrandLogo({ ...options, variant: "loading" })
  });

  function apply() {
    document.querySelectorAll("img[data-brand-logo]").forEach(image => {
      image.src = assetForVariant(image.dataset.brandVariant || "desktop");
      image.alt = image.alt || "NewsNeta official logo";
    });
  }

  global.NewsNetaBrand = Object.freeze({ version, assets, tokens, components, apply });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})(window);
