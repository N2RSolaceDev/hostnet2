// === DOM Elements ===
const nameInput = document.getElementById('name');
const bioInput = document.getElementById('bio');
const avatarInput = document.getElementById('avatar');
const musicInput = document.getElementById('music');
const linksContainer = document.getElementById('links-container');
const saveBtn = document.getElementById('save-btn');

// === Load Profile on Page Load ===
window.onload = async () => {
  try {
    const res = await fetch('/profile/me');
    if (!res.ok) {
      window.location.href = '/';
      return;
    }

    const profile = await res.json();

    // Fill in existing profile data
    nameInput.value = profile.name || '';
    bioInput.value = profile.bio || '';
    avatarInput.value = profile.avatar || '';
    musicInput.value = profile.music || '';

    // Load existing links
    const links = profile.links || [];
    links.forEach(link => addLinkField(link.title, link.url));
  } catch (err) {
    console.error('Failed to load profile:', err);
    alert('Failed to load profile. Please log in again.');
    window.location.href = '/';
  }
};

// === Add New Link Field ===
function addLinkField(title = '', url = '') {
  const div = document.createElement('div');
  div.className = 'link-group';

  div.innerHTML = `
    <input type="text" placeholder="Link Title" value="${title}" />
    <input type="url" placeholder="https://example.com " value="${url}" />
    <button type="button" onclick="removeLink(this)">Remove</button>
  `;

  linksContainer.appendChild(div);
}

// === Remove Link Field ===
window.removeLink = (element) => {
  element.parentElement.remove();
};

// === Add New Link Button Click ===
document.getElementById('add-link-btn')?.addEventListener('click', () => {
  addLinkField();
});

// === Save Profile ===
window.saveProfile = async () => {
  const links = [];

  document.querySelectorAll('.link-group').forEach(group => {
    const inputs = group.querySelectorAll('input');
    const title = inputs[0].value.trim();
    const url = inputs[1].value.trim();
    if (title && url) {
      links.push({ title, url });
    }
  });

  const data = {
    name: nameInput.value.trim(),
    bio: bioInput.value.trim(),
    avatar: avatarInput.value.trim(),
    music: musicInput.value.trim(),
    links,
  };

  try {
    const res = await fetch('/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      alert('Profile saved successfully!');
    } else {
      const text = await res.text();
      alert(`Failed to save profile: ${text}`);
    }
  } catch (err) {
    console.error('Error saving profile:', err);
    alert('Network error. Please try again.');
  }
};
