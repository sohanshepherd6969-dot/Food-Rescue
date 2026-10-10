/* Reusable listing renderers. */

// Marketplace grid card (distributor).
function foodCard(l) {
  const donor = l.donorId || {};
  return `<div class="col-12 col-sm-6 col-xl-4 col-xxl-3">
    <div class="fr-card food-card">
      ${imgTag(l.imageUrl, 'food-img', l.title)}
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <h3 class="h6 fw-semibold mb-0">${esc(l.title)}</h3>
          <span class="fw-semibold ${l.pricePerPlate === 0 ? 'text-green' : 'text-orange'} text-nowrap">${fmtPrice(l.pricePerPlate)}</span>
        </div>
        <div class="food-meta"><i class="bi bi-geo-alt"></i> ${esc(l.area)} · <i class="bi bi-people"></i> ${l.quantityPlates} plates</div>
        <div class="food-meta"><i class="bi bi-shop"></i> ${esc(donor.organizationName || donor.name || '')}</div>
        <div>${starsHtml(l.donorRating?.avg, l.donorRating?.count)}</div>
        <div class="d-flex flex-wrap gap-1">${typeBadges(l)}</div>
        <div class="food-meta"><i class="bi bi-clock"></i> Pickup by ${fmtDate(l.pickupDeadline)}</div>
        <a href="/distributor/food.html?id=${l._id}" class="btn btn-primary btn-sm mt-auto">View Details</a>
      </div>
    </div></div>`;
}

// Horizontal row used in donor lists. `actions` is extra HTML on the right.
function listingRow(l, actions = '') {
  const claim = l.claim;
  return `<div class="fr-card p-3 mb-3">
    <div class="d-flex gap-3 align-items-start">
      ${imgTag(l.imageUrl, 'food-thumb', l.title)}
      <div class="flex-grow-1 min-w-0">
        <div class="d-flex flex-wrap justify-content-between gap-2">
          <a href="/donor/listing.html?id=${l._id}" class="h6 fw-semibold mb-0 text-decoration-none text-reset">${esc(l.title)}</a>
          ${statusBadge(l.status, l)}
        </div>
        <div class="d-flex flex-wrap gap-1 my-1">${typeBadges(l)}</div>
        <div class="food-meta"><i class="bi bi-geo-alt"></i> ${esc(l.area)} · ${l.quantityPlates} plates · ${fmtPrice(l.pricePerPlate)} · <i class="bi bi-clock"></i> ${fmtDate(l.pickupDeadline)}</div>
        ${claim ? `<div class="food-meta mt-1"><i class="bi bi-truck"></i> ${claim.status === 'completed' ? 'Collected by' : 'Claimed by'} <b>${esc(claim.distributorId?.organizationName || claim.distributorId?.name)}</b></div>` : ''}
      </div>
      <div class="d-flex flex-column gap-2 align-items-end">${actions}</div>
    </div></div>`;
}
