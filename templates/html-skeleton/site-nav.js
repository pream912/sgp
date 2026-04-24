(function() {
  document.addEventListener('DOMContentLoaded', function() {
    fetch('./site-config.json')
      .then(function(res) { return res.ok ? res.json() : Promise.reject('not found'); })
      .then(function(config) { applyNav(config); })
      .catch(function() { /* graceful degradation: static HTML nav remains */ });
  });

  function applyNav(config) {
    var nav = config.navigation;
    if (!nav || !nav.length) return;

    var currentFile = location.pathname.split('/').pop() || 'index.html';

    // --- Logo ---
    updateLogo(config);

    // --- Desktop Nav ---
    var desktopEl = document.querySelector('[data-nav="desktop"]') || document.querySelector('header nav');
    if (desktopEl && !desktopEl.querySelector('.group')) {
      rebuildDesktopNav(desktopEl, nav, currentFile);
    }

    // --- Mobile Nav ---
    var mobileEl = document.querySelector('[data-nav="mobile"]');
    if (!mobileEl) {
      // fallback: look for a hidden div with links inside header
      var header = document.querySelector('[data-section="header"]') || document.querySelector('header');
      if (header) {
        var divs = header.querySelectorAll('div');
        for (var i = 0; i < divs.length; i++) {
          if (divs[i].querySelector('a') && divs[i].classList.contains('hidden')) {
            mobileEl = divs[i];
            break;
          }
        }
      }
    }
    if (mobileEl && mobileEl.querySelectorAll('a').length <= 5) {
      rebuildMobileNav(mobileEl, nav, currentFile);
    }

    // --- Footer Links ---
    var footerEl = document.querySelector('[data-nav="footer-links"]');
    if (footerEl) {
      rebuildFooterLinks(footerEl, nav, currentFile);
    }
  }

  function updateLogo(config) {
    var logoLink = document.querySelector('[data-nav="logo"]');
    if (!logoLink) return;

    if (config.logo) {
      var img = logoLink.querySelector('img');
      if (img) {
        // Logo img already exists, just update src
        img.src = config.logo;
      } else {
        // No img exists (site was generated without logo) — create one
        var newImg = document.createElement('img');
        newImg.src = config.logo;
        newImg.alt = config.businessName || 'Logo';
        newImg.className = 'h-10';
        logoLink.textContent = ''; // Remove text (business name)
        logoLink.appendChild(newImg);
      }
    } else {
      // No logo in config — ensure business name text is shown
      var existingImg = logoLink.querySelector('img');
      if (existingImg && config.businessName) {
        logoLink.textContent = config.businessName;
      }
    }
  }

  function captureClasses(container, selector) {
    var el = container.querySelector(selector);
    return el ? el.className : '';
  }

  function rebuildDesktopNav(container, nav, currentFile) {
    // Capture classes from existing links before clearing
    // We need to distinguish active vs inactive link classes
    var existingLinks = container.querySelectorAll('a');
    var activeClass = '';
    var linkClass = '';

    for (var i = 0; i < existingLinks.length; i++) {
      var href = existingLinks[i].getAttribute('href');
      var isCurrentPage = href === currentFile
        || (currentFile === 'index.html' && (href === '/' || href === './index.html' || href === 'index.html'));
      if (isCurrentPage) {
        activeClass = existingLinks[i].className;
      } else if (!linkClass) {
        // Capture the first non-active link's class as the inactive style
        linkClass = existingLinks[i].className;
      }
    }

    // Fallbacks: if we only found one type, use it for both
    if (!linkClass) linkClass = activeClass;
    if (!activeClass) activeClass = linkClass;

    // Clear existing links
    container.innerHTML = '';

    nav.forEach(function(item) {
      if (item.children && item.children.length > 0) {
        // Dropdown for sub-pages
        var group = document.createElement('div');
        group.className = 'relative group';

        var parentLink = document.createElement('a');
        parentLink.href = item.path;
        parentLink.textContent = item.name;
        parentLink.className = (item.path === currentFile) ? activeClass : linkClass;
        group.appendChild(parentLink);

        var dropdown = document.createElement('div');
        dropdown.className = 'absolute right-0 top-full pt-2 z-50 hidden group-hover:block';

        var dropdownInner = document.createElement('div');
        var childCount = item.children.length;
        // Use multi-column for many items, single column for few
        if (childCount > 6) {
          var colCount = Math.min(3, Math.ceil(childCount / 5));
          var colWidth = colCount * 200;
          dropdownInner.className = 'bg-white/95 backdrop-blur-2xl border border-white/30 rounded-2xl shadow-2xl p-6';
          dropdownInner.style.width = colWidth + 'px';
          var grid = document.createElement('div');
          grid.className = 'grid gap-x-6 gap-y-1';
          grid.style.gridTemplateColumns = 'repeat(' + colCount + ', 1fr)';
          item.children.forEach(function(child) {
            var childLink = document.createElement('a');
            childLink.href = child.path;
            childLink.textContent = child.name;
            childLink.className = 'block py-1.5 text-sm text-text/80 hover:text-primary transition ' + ((child.path === currentFile) ? 'font-bold text-primary' : '');
            grid.appendChild(childLink);
          });
          dropdownInner.appendChild(grid);
        } else {
          dropdownInner.className = 'bg-white/95 backdrop-blur-2xl border border-white/30 rounded-2xl shadow-2xl p-4 min-w-[200px]';
          item.children.forEach(function(child) {
            var childLink = document.createElement('a');
            childLink.href = child.path;
            childLink.textContent = child.name;
            childLink.className = 'block py-1.5 px-2 text-sm text-text/80 hover:text-primary transition rounded-lg hover:bg-primary/5 ' + ((child.path === currentFile) ? 'font-bold text-primary' : '');
            dropdownInner.appendChild(childLink);
          });
        }

        dropdown.appendChild(dropdownInner);
        group.appendChild(dropdown);
        container.appendChild(group);
      } else {
        var link = document.createElement('a');
        link.href = item.path;
        link.textContent = item.name;
        link.className = (item.path === currentFile) ? activeClass : linkClass;
        container.appendChild(link);
      }
    });
  }

  function rebuildMobileNav(container, nav, currentFile) {
    // Capture classes from a non-active link to avoid picking up active styling
    var linksWrapper = container;
    var innerNav = container.querySelector('nav') || container.querySelector('ul');
    if (innerNav) linksWrapper = innerNav;

    var mobileLinks = (innerNav || container).querySelectorAll('a');
    var linkClass = '';
    for (var j = 0; j < mobileLinks.length; j++) {
      var mHref = mobileLinks[j].getAttribute('href');
      var mIsActive = mHref === currentFile
        || (currentFile === 'index.html' && (mHref === '/' || mHref === './index.html' || mHref === 'index.html'));
      if (!mIsActive) {
        linkClass = mobileLinks[j].className;
        break;
      }
    }
    if (!linkClass) linkClass = captureClasses(container, 'a');

    // Clear existing links in the wrapper
    linksWrapper.innerHTML = '';

    nav.forEach(function(item) {
      var link = document.createElement('a');
      link.href = item.path;
      link.textContent = item.name;
      link.className = linkClass + ((item.path === currentFile) ? ' font-bold text-primary' : '');
      linksWrapper.appendChild(link);

      // Sub-pages as indented links
      if (item.children && item.children.length > 0) {
        item.children.forEach(function(child) {
          var childLink = document.createElement('a');
          childLink.href = child.path;
          childLink.textContent = child.name;
          childLink.className = linkClass + ' pl-4 text-sm opacity-80' + ((child.path === currentFile) ? ' font-bold text-primary' : '');
          linksWrapper.appendChild(childLink);
        });
      }
    });
  }

  function rebuildFooterLinks(container, nav, currentFile) {
    var linkClass = captureClasses(container, 'a');
    container.innerHTML = '';

    nav.forEach(function(item) {
      var link = document.createElement('a');
      link.href = item.path;
      link.textContent = item.name;
      link.className = linkClass || 'hover:text-primary transition-colors';
      container.appendChild(link);
    });
  }
})();
