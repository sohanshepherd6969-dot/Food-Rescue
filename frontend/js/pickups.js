/* Pickup (claim) cards + actions, shared by the donor and distributor pages.
   `me` is 'donor' or 'distributor'; the card shows the other party. */
function claimCard(c, me) {
  const l = c.listingId || {};
  const other = me === 'donor' ? c.distributorId : c.donorId;
  const otherLabel = me === 'donor' ? 'Distributor' : 'Donor';
  const detailsHref = me === 'donor' ? `/donor/listing.html?id=${l._id}` : `/distributor/food.html?id=${l._id}`;

  let actions = `<a href="${detailsHref}" class="btn btn-sm btn-light">View</a>`;
  if (c.status === 'claimed') {
    actions += `<button class="btn btn-sm btn-primary" data-act="complete" data-id="${c._id}">Mark Collected</button>
                <button class="btn btn-sm btn-outline-danger" data-act="cancel" data-id="${c._id}">Cancel</button>`;
  } else if (c.status === 'completed' && me === 'distributor') {
    actions += c.myReview
      ? `<span class="small text-muted">You rated <span class="stars">${'★'.repeat(c.myReview.rating)}</span></span>`
      : `<button class="btn btn-sm btn-outline-primary" data-act="rate" data-id="${c._id}" data-name="${esc(other?.organizationName || other?.name)}">Rate Donor</button>`;
  }

  const when = c.status === 'completed' ? `Collected ${fmtDate(c.completedAt)}`
    : c.status === 'cancelled' ? `Cancelled ${fmtDate(c.cancelledAt)}` : `Pickup by ${fmtDate(l.pickupDeadline)}`;

  return `<div class="fr-card p-3 mb-3"><div class="d-flex gap-3 align-items-start flex-wrap flex-sm-nowrap">
    ${imgTag(l.imageUrl, 'food-thumb', l.title)}
    <div class="flex-grow-1 min-w-0">
      <div class="d-flex flex-wrap justify-content-between gap-2"><span class="h6 fw-semibold mb-0">${esc(l.title)}</span>${claimBadge(c.status)}</div>
      <div class="food-meta mt-1"><i class="bi bi-geo-alt"></i> ${esc(l.area)} · ${l.quantityPlates} plates · ${fmtPrice(l.pricePerPlate)}</div>
      <div class="food-meta"><i class="bi bi-clock"></i> ${when}</div>
      <div class="food-meta"><i class="bi bi-person"></i> ${otherLabel}: <b>${esc(other?.organizationName || other?.name || '')}</b>
        ${other?.phone && c.status === 'claimed' ? ` · <a href="tel:${esc(other.phone)}"><i class="bi bi-telephone"></i> ${esc(other.phone)}</a>` : ''}</div>
    </div>
    <div class="d-flex flex-row flex-sm-column gap-2 align-items-end">${actions}</div>
  </div></div>`;
}

// Wires the buttons inside `container`; calls `reload()` after a successful action.
function bindClaimActions(container, reload) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    try {
      if (btn.dataset.act === 'complete') {
        if (!(await confirmDialog('Mark as collected?', 'Confirm the food has been picked up. This completes the pickup.', 'Yes, Collected'))) return;
        await api(`/claims/${id}/complete`, { method: 'POST' });
        toast('Pickup marked as collected. Thank you!');
      } else if (btn.dataset.act === 'cancel') {
        if (!(await confirmDialog('Cancel this pickup?', 'The food goes back to the marketplace for other distributors.', 'Cancel Pickup', 'btn-danger'))) return;
        await api(`/claims/${id}/cancel`, { method: 'POST' });
        toast('Pickup cancelled.');
      } else if (btn.dataset.act === 'rate') {
        const r = await ratingDialog('Rate ' + btn.dataset.name);
        if (!r) return;
        await api('/reviews', { method: 'POST', body: { claimId: id, ...r } });
        toast('Thanks for rating!');
      }
      reload();
    } catch (ex) { toast(ex.message, 'danger'); }
  });
}

// Tabs + list for a pickups page. `endpoint` = '/claims/mine' or '/claims/donor'.
function pickupsPage(endpoint, me) {
  const TABS = [['claimed', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
  let tab = qs('tab') || 'claimed';
  let claims = [];
  const list = document.getElementById('list');
  const tabs = document.getElementById('tabs');

  function render() {
    tabs.innerHTML = TABS.map(([k, label]) => `<li class="nav-item"><a href="#" class="nav-link ${k === tab ? 'active' : ''}" data-tab="${k}">${label} (${claims.filter((c) => c.status === k).length})</a></li>`).join('');
    const shown = claims.filter((c) => c.status === tab);
    const empty = me === 'distributor' && tab === 'claimed'
      ? emptyState('truck', 'No active pickups.', '<a href="/distributor/marketplace.html" class="btn btn-primary btn-sm">Browse food</a>')
      : emptyState('inbox', 'Nothing here yet.');
    list.innerHTML = shown.length ? shown.map((c) => claimCard(c, me)).join('') : empty;
  }
  tabs.onclick = (e) => {
    const a = e.target.closest('[data-tab]');
    if (!a) return;
    e.preventDefault();
    tab = a.dataset.tab;
    history.replaceState(null, '', '?tab=' + tab);
    render();
  };
  function load() {
    list.innerHTML = loadingState();
    api(endpoint).then((d) => { claims = d.claims; render(); }).catch((e) => { list.innerHTML = emptyState('exclamation-circle', esc(e.message)); });
  }
  bindClaimActions(list, load);
  load();
}
