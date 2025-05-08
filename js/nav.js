document.addEventListener("DOMContentLoaded", function () {
  const navItems = [
    { name: "Home", href: "index.html" },
    { name: "Copy Steers", href: "copy-steers.html" },
    { name: "JSON Visualizer", href: "json-visualizer.html" },
  ];

  const navbar = document.createElement("nav");
  navbar.className = "navbar";

  const container = document.createElement("div");
  container.className = "container";

  const navList = document.createElement("ul");
  navList.className = "nav-links";

  navItems.forEach((item) => {
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.href;
    link.textContent = item.name;
    listItem.appendChild(link);
    navList.appendChild(listItem);
  });

  container.appendChild(navList);
  navbar.appendChild(container);

  // Insert the navbar at the beginning of the body
  document.body.insertBefore(navbar, document.body.firstChild);
});
