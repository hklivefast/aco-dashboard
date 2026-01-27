<% 
const renderLayout = function(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - ACO Dashboard</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav class="navbar">
    <a href="/" class="navbar-brand">🤖 ACO Dashboard</a>
    
    <div class="navbar-nav">
      <a href="/dashboard" class="active">Dashboard</a>
      <a href="/products">Products</a>
      <a href="/releases">Releases</a>
      
      <% if (user.isAdmin) { %>
      <a href="/admin">Admin</a>
      <% } %>
      
      <div class="user-info">
        <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" alt="${user.username}">
        <span>${user.username}</span>
        <a href="/logout" class="btn btn-outline btn-sm">Logout</a>
      </div>
    </div>
  </nav>

  <main class="container">
    ${body}
  </main>
</body>
</html>`;
};
%>
