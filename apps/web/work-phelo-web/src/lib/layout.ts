// Central layout spacing config — edit the px/pt/pb values here to affect the whole app.
// Left padding is driven by --page-pl in globals.css so it can differ per module.
//
// Usage (template literal or cn):
//   className={`${pageBanner} shrink-0`}
//   className={cn(pageContent, 'other-class')}

// Left inset comes from --page-pl (globals.css): the old gutter in HR, 0 in the other modules.
const px = 'pl-(--page-pl) pr-4 sm:pr-6 lg:pr-8';
const ptLg = 'pt-5 sm:pt-6 lg:pt-8'; // large top padding — banner / hero sections
const ptSm = 'pt-4 sm:pt-6'; // small top padding — breadcrumb / secondary rows
const pbLg = 'pb-6 sm:pb-8'; // large bottom padding — main scrollable content
const pbSm = 'pb-4 sm:pb-6'; // small bottom padding — shrink-0 banner rows

// Page-level horizontal padding only (use for tab bars, sticky sub-headers, etc.)
export const pagePx = px;

// Top section: banner / hero / profile header
export const pageBanner = `${px} ${ptLg} ${pbSm}`;

// Top section: layout header above tab strip (ends with pb-2 to let the tab strip sit flush)
export const pageHeader = `${px} ${ptLg} pb-2`;

// Secondary header row: breadcrumbs, sub-banners
export const pageBreadcrumb = `${px} ${ptSm}`;

// Main content area below a tab bar — the scrollable/growing region
export const pageContent = `${px} pt-4 ${pbLg}`;

// Full-page wrapper with padding on all sides (e.g. project detail layout)
export const pageWrapper = 'p-4 sm:p-6 lg:p-8';
