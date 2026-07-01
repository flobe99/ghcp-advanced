const catalogSection = document.getElementById("catalogSection");
const detailSection = document.getElementById("detailSection");
const catalogState = document.getElementById("catalogState");
const detailState = document.getElementById("detailState");
const catalogGrid = document.getElementById("catalogGrid");
const catalogFiltersForm = document.getElementById("catalogFilters");
const filterQueryInput = document.getElementById("filterQuery");
const minPriceInput = document.getElementById("minPrice");
const maxPriceInput = document.getElementById("maxPrice");
const categoryFilters = document.getElementById("categoryFilters");
const resetFiltersButton = document.getElementById("resetFiltersButton");
const duckOfDayState = document.getElementById("duckOfDayState");
const duckOfDayCard = document.getElementById("duckOfDayCard");
const detailCard = document.getElementById("detailCard");
const backButton = document.getElementById("backButton");
const cartState = document.getElementById("cartState");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutState = document.getElementById("checkoutState");
const checkoutButton = document.getElementById("checkoutButton");
const checkoutConfirmation = document.getElementById("checkoutConfirmation");
const quizState = document.getElementById("quizState");
const quizForm = document.getElementById("quizForm");
const quizResult = document.getElementById("quizResult");
let cartHasItems = false;
let checkoutSubmitting = false;
let knownCategories = [];
let quizQuestions = [];

const checkoutFieldIds = [
  "shippingName",
  "email",
  "address",
  "cardHolder",
  "cardNumber",
  "cardExpiry",
  "cardCvc",
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // ignore JSON parse errors for non-JSON responses
    }
    throw new Error(message);
  }
  return response.json();
}

async function sendJson(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload && typeof payload.error === "string"
      ? payload.error
      : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function showCatalogOnly() {
  catalogSection.classList.remove("hidden");
  detailSection.classList.add("hidden");
  backButton.classList.add("hidden");
}

function showDetailPanel() {
  detailSection.classList.remove("hidden");
  backButton.classList.remove("hidden");
}

function renderCategoryFilters() {
  categoryFilters.innerHTML = "";

  for (const category of knownCategories) {
    const option = document.createElement("label");
    option.className = "category-option";
    option.innerHTML = `
      <input type="checkbox" value="${category}" />
      <span>${category}</span>
    `;
    categoryFilters.appendChild(option);
  }
}

function updateKnownCategoriesFromDucks(ducks) {
  const categories = Array.from(
    new Set(ducks.map((duck) => duck.category).filter((category) => typeof category === "string"))
  ).sort((a, b) => a.localeCompare(b));

  knownCategories = categories;
  renderCategoryFilters();
}

function getCatalogFiltersFromForm() {
  const query = filterQueryInput.value.trim();
  const selectedCategories = Array.from(
    categoryFilters.querySelectorAll('input[type="checkbox"]:checked')
  ).map((input) => input.value);
  const minPrice = minPriceInput.value.trim();
  const maxPrice = maxPriceInput.value.trim();

  return {
    query,
    categories: selectedCategories,
    minPrice,
    maxPrice,
  };
}

function buildCatalogQueryString(filters) {
  const params = new URLSearchParams();

  if (filters.query.length > 0) {
    params.set("q", filters.query);
  }

  for (const category of filters.categories) {
    params.append("category", category);
  }

  if (filters.minPrice.length > 0) {
    params.set("minPrice", filters.minPrice);
  }

  if (filters.maxPrice.length > 0) {
    params.set("maxPrice", filters.maxPrice);
  }

  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

function syncCheckoutButtonState() {
  checkoutButton.disabled = checkoutSubmitting || !cartHasItems;
}

function renderCatalog(ducks, emptyMessage) {
  catalogGrid.innerHTML = "";
  if (!ducks.length) {
    catalogState.textContent = emptyMessage || "No ducks available right now.";
    return;
  }

  catalogState.textContent = `${ducks.length} ducks available`;

  for (const duck of ducks) {
    const card = document.createElement("article");
    card.className = "duck-card";
    card.innerHTML = `
      <h3>${duck.name}</h3>
      <p>${duck.tagline}</p>
      <div class="meta">
        <span>${duck.category}</span>
        <strong>${money.format(duck.priceCents / 100)}</strong>
      </div>
      <div class="card-actions">
        <input class="qty-input" data-qty-for="${duck.id}" type="number" min="1" value="1" />
        <button class="open-link" data-add-id="${duck.id}" type="button">Add to cart</button>
      </div>
      <button class="small-button" data-id="${duck.id}" type="button">Open details</button>
    `;
    catalogGrid.appendChild(card);
  }

  catalogGrid.querySelectorAll(".open-link").forEach((button) => {
    button.addEventListener("click", () => {
      const addId = button.getAttribute("data-add-id");
      if (addId) {
        const quantityInput = catalogGrid.querySelector(`[data-qty-for="${addId}"]`);
        const quantity = Number(quantityInput?.value ?? "1");
        void addToCart(addId, quantity);
        return;
      }

      const id = button.getAttribute("data-id");
      if (id) {
        void loadDetail(id);
      }
    });
  });

  catalogGrid.querySelectorAll("[data-id]").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    if (button.classList.contains("open-link")) {
      return;
    }

    button.addEventListener("click", () => {
      const id = button.getAttribute("data-id");
      if (id) {
        void loadDetail(id);
      }
    });
  });
}

function renderDuckOfTheDay(result) {
  duckOfDayCard.classList.add("hidden");

  if (result.emptyState) {
    duckOfDayState.textContent = result.emptyState.message;
    duckOfDayCard.innerHTML = "";
    return;
  }

  if (!result.duck) {
    duckOfDayState.textContent = "We could not load the featured duck right now.";
    duckOfDayCard.innerHTML = "";
    return;
  }

  const duck = result.duck;
  duckOfDayState.textContent = "Featured today";
  duckOfDayCard.className = "duck-of-day-card";
  duckOfDayCard.innerHTML = `
    <strong>${duck.name}</strong>
    <span>${duck.category} · ${money.format(duck.priceCents / 100)}</span>
    <p>${duck.tagline}</p>
    <button class="small-button" id="openDuckOfDay" type="button">Open details</button>
  `;
  duckOfDayCard.classList.remove("hidden");

  const openButton = document.getElementById("openDuckOfDay");
  openButton.addEventListener("click", () => {
    void loadDetail(duck.id);
  });
}

async function loadDuckOfTheDay() {
  duckOfDayState.textContent = "Loading featured duck...";
  duckOfDayCard.classList.add("hidden");

  try {
    const result = await fetchJson("/api/ducks/of-the-day");
    renderDuckOfTheDay(result);
  } catch {
    duckOfDayState.textContent = "We could not load the featured duck right now.";
    duckOfDayCard.classList.add("hidden");
  }
}

function renderQuizQuestions(questions) {
  quizQuestions = questions;
  quizForm.innerHTML = "";

  for (const question of questions) {
    const wrapper = document.createElement("fieldset");
    wrapper.className = "quiz-question";
    wrapper.setAttribute("data-question-id", question.id);
    wrapper.innerHTML = `<p>${question.prompt}</p>`;

    for (const option of question.options) {
      const label = document.createElement("label");
      label.className = "quiz-option";
      label.innerHTML = `
        <input type="radio" name="${question.id}" value="${option.id}" required />
        <span>${option.text}</span>
      `;
      wrapper.appendChild(label);
    }

    const error = document.createElement("p");
    error.className = "field-error";
    error.setAttribute("data-question-error", question.id);
    error.textContent = "";
    wrapper.appendChild(error);

    quizForm.appendChild(wrapper);
  }

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "open-link";
  submit.textContent = "Reveal my duck";
  quizForm.appendChild(submit);
}

async function loadQuiz() {
  quizState.textContent = "Loading quiz...";
  quizForm.classList.add("hidden");
  quizResult.classList.add("hidden");

  try {
    const payload = await fetchJson("/api/quiz/questions");
    renderQuizQuestions(payload.questions || []);
    quizState.textContent = "Answer all questions to discover your duck match.";
    quizForm.classList.remove("hidden");
  } catch {
    quizState.textContent = "We could not load the quiz right now.";
  }
}

function renderQuizResult(result) {
  quizResult.classList.remove("hidden");
  quizResult.innerHTML = `
    <h3>Your match: ${result.duck.name}</h3>
    <p><strong>${result.duck.category}</strong> · ${money.format(result.duck.priceCents / 100)}</p>
    <p>${result.message}</p>
    <p>${result.duck.tagline}</p>
    <button class="small-button" id="openQuizDuck" type="button">Open duck details</button>
  `;

  const openButton = document.getElementById("openQuizDuck");
  openButton.addEventListener("click", () => {
    void loadDetail(result.duck.id);
  });
}

async function handleQuizSubmit(event) {
  event.preventDefault();
  const formData = new FormData(quizForm);
  const answers = {};
  let hasError = false;
  let firstInvalidQuestion = null;

  for (const question of quizQuestions) {
    const fieldset = quizForm.querySelector(`[data-question-id="${question.id}"]`);
    const errorNode = quizForm.querySelector(`[data-question-error="${question.id}"]`);
    if (fieldset) {
      fieldset.classList.remove("error");
    }
    if (errorNode) {
      errorNode.textContent = "";
    }
  }

  for (const question of quizQuestions) {
    const value = String(formData.get(question.id) || "");
    answers[question.id] = value;
    if (!value) {
      const fieldset = quizForm.querySelector(`[data-question-id="${question.id}"]`);
      const errorNode = quizForm.querySelector(`[data-question-error="${question.id}"]`);
      if (fieldset) {
        fieldset.classList.add("error");
        if (!firstInvalidQuestion) {
          firstInvalidQuestion = fieldset;
        }
      }
      if (errorNode) {
        errorNode.textContent = "Please select an option.";
      }
      hasError = true;
    }
  }

  if (hasError) {
    quizState.textContent = "Please answer each question to continue.";
    quizResult.classList.add("hidden");
    if (firstInvalidQuestion) {
      firstInvalidQuestion.scrollIntoView({ behavior: "smooth", block: "center" });
      const firstInput = firstInvalidQuestion.querySelector('input[type="radio"]');
      if (firstInput) {
        firstInput.focus();
      }
    }
    return;
  }

  quizState.textContent = "Calculating your duck...";

  try {
    const result = await sendJson("/api/quiz/result", "POST", { answers });
    quizState.textContent = "Your duck match is ready.";
    renderQuizResult(result);
  } catch (error) {
    quizState.textContent = error instanceof Error ? error.message : "Quiz request failed.";
  }
}

function renderCart(cart) {
  cartItems.innerHTML = "";
  cartHasItems = Array.isArray(cart.items) && cart.items.length > 0;
  syncCheckoutButtonState();

  if (!cart.items.length) {
    cartState.textContent = "Your cart is empty.";
    cartTotal.textContent = "Total: $0.00";
    setCheckoutState("Add at least one duck before checkout.");
    return;
  }

  cartState.textContent = `${cart.items.length} item(s) in cart`;
  cartTotal.textContent = `Total: ${money.format(cart.totalCents / 100)}`;
  if (!checkoutSubmitting) {
    setCheckoutState("");
  }

  for (const item of cart.items) {
    const row = document.createElement("article");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="cart-item-head">
        <strong>${item.name}</strong>
        <span>${money.format(item.lineTotalCents / 100)}</span>
      </div>
      <div class="cart-item-controls">
        <input class="qty-input" data-cart-qty="${item.duckId}" type="number" min="1" value="${item.quantity}" />
        <button class="small-button" data-update-id="${item.duckId}" type="button">Update</button>
        <button class="small-button danger" data-remove-id="${item.duckId}" type="button">Remove</button>
      </div>
    `;
    cartItems.appendChild(row);
  }

  cartItems.querySelectorAll("[data-update-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-update-id");
      if (!id) {
        return;
      }

      const quantityInput = cartItems.querySelector(`[data-cart-qty="${id}"]`);
      const quantity = Number(quantityInput?.value ?? "1");
      void updateCart(id, quantity);
    });
  });

  cartItems.querySelectorAll("[data-remove-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-remove-id");
      if (id) {
        void removeFromCart(id);
      }
    });
  });
}

function renderDetail(duck) {
  detailState.textContent = "";
  detailCard.classList.remove("hidden");

  const traits = duck.personalityTraits
    .map((trait) => `<span class="trait">${trait}</span>`)
    .join("");

  detailCard.innerHTML = `
    <h3>${duck.name}</h3>
    <p><strong>${duck.category}</strong> · ${money.format(duck.priceCents / 100)}</p>
    <p>${duck.tagline}</p>
    <p>${duck.longDescription}</p>
    <p><strong>Stock:</strong> ${duck.stockLevel}</p>
    <div class="traits">${traits}</div>
  `;
}

async function loadCatalog() {
  catalogState.textContent = "Loading catalog...";
  try {
    const filters = getCatalogFiltersFromForm();
    const query = buildCatalogQueryString(filters);
    const data = await fetchJson(`/api/ducks${query}`);
    if (knownCategories.length === 0) {
      const allData = await fetchJson("/api/ducks");
      updateKnownCategoriesFromDucks(allData.ducks || []);
      for (const input of categoryFilters.querySelectorAll('input[type="checkbox"]')) {
        input.checked = filters.categories.includes(input.value);
      }
    }
    renderCatalog(data.ducks || [], data.emptyState?.message);
  } catch (error) {
    catalogState.textContent = error instanceof Error
      ? error.message
      : "We could not load the catalog right now.";
  }
}

async function loadCart() {
  cartState.textContent = "Loading cart...";
  try {
    const cart = await fetchJson("/api/cart");
    renderCart(cart);
  } catch (error) {
    cartState.textContent = error instanceof Error ? error.message : "We could not load your cart right now.";
  }
}

async function addToCart(duckId, quantity) {
  try {
    const cart = await sendJson("/api/cart/items", "POST", { duckId, quantity });
    renderCart(cart);
  } catch (error) {
    cartState.textContent = error instanceof Error ? error.message : "Could not add this duck to your cart.";
  }
}

async function updateCart(duckId, quantity) {
  try {
    const cart = await sendJson(`/api/cart/items/${encodeURIComponent(duckId)}`, "PATCH", { quantity });
    renderCart(cart);
  } catch (error) {
    cartState.textContent = error instanceof Error ? error.message : "Could not update this cart item.";
  }
}

async function removeFromCart(duckId) {
  try {
    const cart = await sendJson(`/api/cart/items/${encodeURIComponent(duckId)}`, "DELETE");
    renderCart(cart);
  } catch (error) {
    cartState.textContent = error instanceof Error ? error.message : "Could not remove this item right now.";
  }
}

function setCheckoutState(message, kind = "") {
  checkoutState.textContent = message;
  checkoutState.classList.remove("checkout-success", "checkout-error");
  if (kind === "success") {
    checkoutState.classList.add("checkout-success");
  }
  if (kind === "error") {
    checkoutState.classList.add("checkout-error");
  }
}

function renderCheckoutConfirmation(order) {
  const lines = (order.items || [])
    .map((item) => `<li>${item.quantity}x ${item.name} - ${money.format(item.lineTotalCents / 100)}</li>`)
    .join("");
  const paymentLine = order.payment && order.payment.method === "card"
    ? `<p><strong>Payment:</strong> Card ending in ${order.payment.cardLast4}</p>`
    : "";

  checkoutConfirmation.innerHTML = `
    <h4>Order confirmed</h4>
    <p><strong>Order ID:</strong> ${order.orderId}</p>
    ${paymentLine}
    <ul>${lines}</ul>
    <p><strong>Total:</strong> ${money.format(order.totalCents / 100)}</p>
  `;
  checkoutConfirmation.classList.remove("hidden");
}

function clearCheckoutFieldErrors() {
  for (const fieldId of checkoutFieldIds) {
    const input = document.getElementById(fieldId);
    const error = document.getElementById(`${fieldId}Error`);
    if (error) {
      error.textContent = "";
    }
    if (input) {
      input.classList.remove("input-error");
    }
  }
}

function setCheckoutFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}Error`);
  if (error) {
    error.textContent = message;
  }
  if (input) {
    input.classList.add("input-error");
  }
}

function validateCheckoutPayload(payload) {
  const fieldErrors = {};

  if (!payload.shippingName.trim()) {
    fieldErrors.shippingName = "Shipping name is required.";
  }
  if (!/^\S+@\S+\.\S+$/.test(payload.email.trim())) {
    fieldErrors.email = "Please provide a valid email address.";
  }
  if (!payload.address.trim()) {
    fieldErrors.address = "Address is required.";
  }
  if (!payload.cardHolder.trim()) {
    fieldErrors.cardHolder = "Card holder is required.";
  }

  const cardNumberDigits = payload.cardNumber.replace(/\D/g, "");
  if (!/^\d{12,19}$/.test(cardNumberDigits)) {
    fieldErrors.cardNumber = "Card number must contain 12 to 19 digits.";
  }

  if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(payload.cardExpiry.trim())) {
    fieldErrors.cardExpiry = "Card expiry must be in MM/YY format.";
  }

  const cvcDigits = payload.cardCvc.replace(/\D/g, "");
  if (!/^\d{3,4}$/.test(cvcDigits)) {
    fieldErrors.cardCvc = "CVC must contain 3 or 4 digits.";
  }

  return fieldErrors;
}

async function handleCheckoutSubmit(event) {
  event.preventDefault();

  if (!cartHasItems) {
    setCheckoutState("Your cart is empty. Add a duck before checking out.", "error");
    syncCheckoutButtonState();
    return;
  }

  const formData = new FormData(checkoutForm);
  clearCheckoutFieldErrors();
  setCheckoutState("");
  checkoutConfirmation.classList.add("hidden");

  const payload = {
    shippingName: String(formData.get("shippingName") || ""),
    email: String(formData.get("email") || ""),
    address: String(formData.get("address") || ""),
    cardHolder: String(formData.get("cardHolder") || ""),
    cardNumber: String(formData.get("cardNumber") || "").replace(/\D/g, ""),
    cardExpiry: String(formData.get("cardExpiry") || "").trim(),
    cardCvc: String(formData.get("cardCvc") || "").replace(/\D/g, ""),
  };

  const fieldErrors = validateCheckoutPayload(payload);
  const fieldErrorEntries = Object.entries(fieldErrors);
  if (fieldErrorEntries.length > 0) {
    for (const [fieldId, message] of fieldErrorEntries) {
      setCheckoutFieldError(fieldId, message);
    }
    setCheckoutState("Please fix the highlighted fields.", "error");
    return;
  }

  checkoutSubmitting = true;
  syncCheckoutButtonState();
  setCheckoutState("Placing order...");

  try {
    const order = await sendJson("/api/checkout", "POST", payload);
    setCheckoutState(
      `Order ${order.orderId} placed successfully (${money.format(order.totalCents / 100)}).`,
      "success"
    );
    renderCheckoutConfirmation(order);
    checkoutForm.reset();
    await loadCart();
    await loadCatalog();
    await loadDuckOfTheDay();
  } catch (error) {
    setCheckoutState(error instanceof Error ? error.message : "Checkout failed. Please try again.", "error");
  } finally {
    checkoutSubmitting = false;
    syncCheckoutButtonState();
  }
}

async function loadDetail(id) {
  showDetailPanel();
  detailCard.classList.add("hidden");
  detailState.textContent = "Loading duck details...";

  try {
    const duck = await fetchJson(`/api/ducks/${encodeURIComponent(id)}`);
    renderDetail(duck);
    const url = new URL(window.location.href);
    url.searchParams.set("duckId", id);
    history.replaceState({}, "", url);
  } catch {
    detailState.textContent = "We could not find that duck.";
    detailCard.classList.add("hidden");
  }
}

backButton.addEventListener("click", () => {
  showCatalogOnly();
  const url = new URL(window.location.href);
  url.searchParams.delete("duckId");
  history.replaceState({}, "", url);
});

catalogFiltersForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void loadCatalog();
});

resetFiltersButton.addEventListener("click", () => {
  catalogFiltersForm.reset();
  for (const input of categoryFilters.querySelectorAll('input[type="checkbox"]')) {
    input.checked = false;
  }
  void loadCatalog();
});

checkoutForm.addEventListener("submit", (event) => {
  void handleCheckoutSubmit(event);
});

quizForm.addEventListener("submit", (event) => {
  void handleQuizSubmit(event);
});

(async function bootstrap() {
  renderCategoryFilters();
  await loadDuckOfTheDay();
  await loadCatalog();
  await loadCart();
  await loadQuiz();
  const url = new URL(window.location.href);
  const duckId = url.searchParams.get("duckId");
  if (duckId) {
    await loadDetail(duckId);
  }
})();
