import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Clock3,
  Coffee,
  CreditCard,
  DollarSign,
  HandCoins,
  Heart,
  KeyRound,
  ListChecks,
  LogIn,
  LogOut,
  Minus,
  Package,
  PackageCheck,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Timer,
  User,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { authenticate, createGuestSession } from "./auth";
import { clientStepLabels, getClientStepProgress, getClientStepState } from "./clientSteps";
import { initialInventory, initialProducts, milkOptions, seedOrders, sizeOptions } from "./data";
import {
  activeOrderConsumption,
  cartConsumption,
  cartTotal,
  createOrder,
  deductInventory,
  defaultOptions,
  findMilk,
  findSize,
  formatCurrency,
  lineUnitPrice,
  stockCheck,
} from "./orderLogic";
import { completePayment, createInitialPaymentState, resetPaymentStatus } from "./payment";
import type { CartLine, InventoryItem, ItemOptions, Order, OrderStatus, Product, RoleKey } from "./types";
import type { AuthMode, AuthSession } from "./auth";
import type { PaymentMethod, PaymentState } from "./payment";

type Notice = {
  tone: "success" | "warning" | "danger";
  title: string;
  detail: string;
};

const roleTabs: Array<{ id: RoleKey; label: string; icon: typeof ShoppingBag }> = [
  { id: "customer", label: "Zákazník", icon: ShoppingBag },
  { id: "staff", label: "Obsluha", icon: ClipboardList },
  { id: "inventory", label: "Sklad", icon: Package },
  { id: "admin", label: "Admin", icon: BarChart3 },
];

const statusMeta: Record<OrderStatus, { label: string; tone: string }> = {
  new: { label: "Nová", tone: "blue" },
  accepted: { label: "Převzatá", tone: "violet" },
  preparing: { label: "V přípravě", tone: "amber" },
  ready: { label: "Hotovo", tone: "green" },
  handed: { label: "Vydáno", tone: "gray" },
  cancelled: { label: "Zrušeno", tone: "red" },
};

const pickupOptions = ["08:30", "08:45", "09:00", "09:15", "09:30", "09:45", "10:00", "10:15"];

const customerName = "Klára Baliová";

function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeRole, setActiveRole] = useState<RoleKey>("customer");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [orders, setOrders] = useState<Order[]>(seedOrders);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(initialProducts[0].id);
  const [draftOptions, setDraftOptions] = useState<ItemOptions>(defaultOptions);
  const [pickupTime, setPickupTime] = useState("09:30");
  const [accountMode, setAccountMode] = useState<"registered" | "guest">("registered");
  const [payment, setPayment] = useState<PaymentState>(createInitialPaymentState);
  const [customerOrderId, setCustomerOrderId] = useState<string | null>(null);
  const [nextOrderNumber, setNextOrderNumber] = useState(1009);
  const [loyaltyPoints, setLoyaltyPoints] = useState(132);
  const [notice, setNotice] = useState<Notice>({
    tone: "success",
    title: "Proces připraven",
    detail: "Menu, platba, sklad i fronta obsluhy jsou synchronizované.",
  });

  const reserved = useMemo(() => activeOrderConsumption(orders), [orders]);
  const total = useMemo(() => cartTotal(cart, products), [cart, products]);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const customerOrder = customerOrderId ? orders.find((order) => order.id === customerOrderId) : undefined;
  const readyOrders = orders.filter((order) => order.status === "ready");
  const activeOrders = orders.filter((order) => !["handed", "cancelled"].includes(order.status));
  const paidRevenue = orders
    .filter((order) => order.paymentStatus === "paid" && order.status !== "cancelled")
    .reduce((sum, order) => sum + order.total, 0);
  const lowStockCount = inventory.filter((item) => item.current - (reserved[item.id] ?? 0) <= item.min).length;
  const isAdminSession = session?.access === "admin";
  const effectiveAccountMode =
    session?.kind === "guest" ? "guest" : session?.kind === "customer" ? "registered" : accountMode;
  const activeRoleTabs = isAdminSession ? roleTabs : roleTabs.filter((tab) => tab.id === "customer");

  function startSession(nextSession: AuthSession) {
    setSession(nextSession);
    setActiveRole("customer");
    setAccountMode(nextSession.registered ? "registered" : "guest");
    setCart([]);
    setPayment(createInitialPaymentState());
    setCustomerOrderId(null);
    setNotice({
      tone: "success",
      title: nextSession.kind === "guest" ? "Pokračujete jako host" : `Přihlášeno: ${nextSession.name}`,
      detail:
        nextSession.access === "admin"
          ? "Admin má přístup ke všem rolím aplikace."
          : "Zobrazuje se zákaznická část aplikace.",
    });
  }

  function logout() {
    setSession(null);
    setActiveRole("customer");
    setAccountMode("registered");
    setCart([]);
    setPayment(createInitialPaymentState());
    setCustomerOrderId(null);
  }

  if (!session) {
    return <AuthScreen onSession={startSession} />;
  }

  function addToCart(product: Product) {
    const options = product.customizable ? draftOptions : defaultOptions;
    setPayment((current) => resetPaymentStatus(current));
    setCart((current) => {
      const existing = current.find(
        (line) =>
          line.productId === product.id &&
          line.options.sizeId === options.sizeId &&
          line.options.milkId === options.milkId &&
          line.options.sugar === options.sugar,
      );

      if (existing) {
        return current.map((line) =>
          line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      return [
        ...current,
        {
          id: `cart-${Date.now()}-${product.id}`,
          productId: product.id,
          quantity: 1,
          options,
        },
      ];
    });
  }

  function updateQuantity(lineId: string, delta: number) {
    setPayment((current) => resetPaymentStatus(current));
    setCart((current) =>
      current
        .map((line) => (line.id === lineId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function updatePayment(nextPayment: PaymentState) {
    setPayment(resetPaymentStatus(nextPayment));
  }

  function finishPayment() {
    const result = completePayment(total, payment);

    if (!result.ok) {
      setPayment((current) => ({
        ...current,
        status: "failed",
        error: result.error,
        receipt: "",
      }));
      return;
    }

    setPayment((current) => ({
      ...current,
      status: "paid",
      error: "",
      receipt: result.receipt,
    }));
  }

  function submitOrder() {
    const currentSession = session;
    if (!currentSession) return;

    if (cart.length === 0) {
      setNotice({
        tone: "warning",
        title: "Košík je prázdný",
        detail: "Vyberte alespoň jednu položku z nabídky.",
      });
      return;
    }

    if (payment.status !== "paid") {
      setNotice({
        tone: "warning",
        title: "Platba není dokončená",
        detail: "Nejdřív dokončete platbu v platebním modulu.",
      });
      return;
    }

    const required = cartConsumption(cart, products);
    const availability = stockCheck(required, inventory, reserved);

    if (!availability.ok) {
      setNotice({
        tone: "danger",
        title: "Surovina není skladem",
        detail: availability.shortages
          .map((shortage) => `${shortage.name}: chybí ${shortage.missing} ${shortage.unit}`)
          .join(", "),
      });
      return;
    }

    const order: Order = {
      ...createOrder({
        cart,
        products,
        number: nextOrderNumber,
        customerName:
          effectiveAccountMode === "registered"
            ? currentSession.kind === "customer"
              ? currentSession.name
              : customerName
            : "Host",
        registered: effectiveAccountMode === "registered",
        pickupTime,
      }),
      stockDeducted: true,
    };

    setInventory((current) => deductInventory(current, order.consumption));
    setOrders((current) => [order, ...current]);
    setCustomerOrderId(order.id);
    setNextOrderNumber((current) => current + 1);
    setCart([]);
    setPayment(createInitialPaymentState());
    setNotice({
      tone: "success",
      title: `Objednávka ${order.number} přijata`,
      detail: `Platba proběhla, zásoby se odečetly a objednávka čeká na obsluhu pro vyzvednutí v ${pickupTime}.`,
    });
  }

  function setOrderStatus(orderId: string, status: OrderStatus) {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;

    if (status === "handed" && !order.stockDeducted) {
      setInventory((current) => deductInventory(current, order.consumption));
      if (order.registered) {
        setLoyaltyPoints((current) => current + order.pointsEarned);
      }
    }

    setOrders((current) =>
      current.map((item) =>
        item.id === orderId
          ? {
              ...item,
              status,
              stockDeducted: status === "handed" ? true : item.stockDeducted,
            }
          : item,
      ),
    );

    if (status === "ready") {
      setNotice({
        tone: "success",
        title: `${order.number} je hotová`,
        detail: "Zákazník dostal notifikaci a může si objednávku vyzvednout.",
      });
    }
  }

  function toggleProduct(productId: string) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, available: !product.available } : product,
      ),
    );
  }

  function changePrice(productId: string, delta: number) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? { ...product, basePrice: Math.max(10, product.basePrice + delta) }
          : product,
      ),
    );
  }

  function restock(ingredientId: string) {
    setInventory((current) =>
      current.map((item) =>
        item.id === ingredientId ? { ...item, current: item.current + item.min } : item,
      ),
    );
  }

  function reportShortage(ingredientId: string) {
    setInventory((current) =>
      current.map((item) =>
        item.id === ingredientId ? { ...item, current: Math.min(item.current, item.min - 1) } : item,
      ),
    );
    setNotice({
      tone: "warning",
      title: "Nedostatek nahlášen",
      detail: "Skladový stav se propsal do kontroly dostupnosti objednávek.",
    });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Coffee size={24} aria-hidden />
          </span>
          <div>
            <p className="eyebrow">Mobilní aplikace</p>
            <h1>Kafe a klid</h1>
          </div>
        </div>

        <div className="kpi-strip" aria-label="Provozní přehled">
          {isAdminSession ? (
            <>
              <Metric icon={ClipboardList} label="Aktivní" value={activeOrders.length.toString()} />
              <Metric icon={DollarSign} label="Tržby" value={formatCurrency(paidRevenue)} />
              <Metric icon={AlertTriangle} label="Nízké zásoby" value={lowStockCount.toString()} />
              <Metric icon={Heart} label="Body" value={loyaltyPoints.toString()} />
            </>
          ) : (
            <>
              <Metric icon={ShoppingBag} label="Košík" value={cart.length.toString()} />
              <Metric icon={Bell} label="Hotové" value={readyOrders.length.toString()} />
              <Metric icon={Heart} label="Body" value={session.registered ? loyaltyPoints.toString() : "0"} />
            </>
          )}
          <button className="session-button" type="button" onClick={logout}>
            <LogOut size={16} aria-hidden />
            {session.name}
          </button>
        </div>
      </header>

      <main className="workspace">
        {isAdminSession && (
          <nav className="role-tabs" aria-label="Role aplikace">
            {activeRoleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={activeRole === tab.id ? "role-tab active" : "role-tab"}
                  onClick={() => setActiveRole(tab.id)}
                  type="button"
                >
                  <Icon size={18} aria-hidden />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        )}

        <ProcessStrip
          order={cart.length === 0 ? customerOrder : undefined}
          notice={notice}
          cartCount={cart.length}
          paymentStatus={payment.status}
        />

        {activeRole === "customer" && (
          <CustomerView
            products={products}
            inventory={inventory}
            reserved={reserved}
            selectedProduct={selectedProduct}
            onSelectProduct={(productId) => {
              setSelectedProductId(productId);
              setDraftOptions(defaultOptions);
            }}
            draftOptions={draftOptions}
            setDraftOptions={setDraftOptions}
            onAdd={addToCart}
            cart={cart}
            total={total}
            onQuantity={updateQuantity}
            pickupTime={pickupTime}
            setPickupTime={setPickupTime}
            accountMode={effectiveAccountMode}
            setAccountMode={setAccountMode}
            canSwitchAccountMode={isAdminSession}
            sessionLabel={session.kind === "guest" ? "Host bez přihlášení" : session.name}
            payment={payment}
            setPayment={updatePayment}
            finishPayment={finishPayment}
            submitOrder={submitOrder}
            customerOrder={customerOrder}
          />
        )}

        {activeRole === "staff" && (
          <StaffView orders={orders} setOrderStatus={setOrderStatus} />
        )}

        {activeRole === "inventory" && (
          <InventoryView
            inventory={inventory}
            reserved={reserved}
            products={products}
            onRestock={restock}
            onReportShortage={reportShortage}
            onToggleProduct={toggleProduct}
          />
        )}

        {activeRole === "admin" && (
          <AdminView
            products={products}
            orders={orders}
            revenue={paidRevenue}
            onToggleProduct={toggleProduct}
            onChangePrice={changePrice}
          />
        )}
      </main>
    </div>
  );
}

function AuthScreen({ onSession }: { onSession: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = authenticate(username, password, mode);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError("");
    onSession(result.session);
  }

  function continueAsGuest() {
    setError("");
    onSession(createGuestSession());
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label="Přihlášení">
        <div className="auth-brand">
          <span className="brand-mark">
            <Coffee size={24} aria-hidden />
          </span>
          <div>
            <p className="eyebrow">Mobilní aplikace</p>
            <h1>Kafe a klid</h1>
          </div>
        </div>

        <div className="segmented auth-mode" role="group" aria-label="Režim">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            <LogIn size={16} aria-hidden />
            Přihlášení
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            <UserPlus size={16} aria-hidden />
            Registrace
          </button>
        </div>

        <form className="auth-form" onSubmit={submitAuth}>
          <label>
            <span>Jméno</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              type="text"
            />
          </label>

          <label>
            <span>Heslo</span>
            <input
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>

          {error && (
            <div className="auth-error" role="alert">
              <Ban size={16} aria-hidden />
              {error}
            </div>
          )}

          <button className="primary-button wide" type="submit">
            {mode === "register" ? <UserPlus size={18} aria-hidden /> : <KeyRound size={18} aria-hidden />}
            {mode === "register" ? "Registrovat" : "Přihlásit"}
          </button>
        </form>

        <button className="guest-button" type="button" onClick={continueAsGuest}>
          <User size={18} aria-hidden />
          Pokračovat jako host
        </button>
      </section>

      <section className="auth-hero" aria-label="Kavárna">
        <img
          src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80"
          alt="Kavárenský stůl s kávou"
        />
        <div className="auth-hero-copy">
          <ShieldCheck size={24} aria-hidden />
          <strong>Osobní objednávky, rychlá obsluha, klidnější provoz.</strong>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Coffee; label: string; value: string }) {
  return (
    <div className="metric">
      <Icon size={17} aria-hidden />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProcessStrip({
  order,
  notice,
  cartCount,
  paymentStatus,
}: {
  order?: Order;
  notice: Notice;
  cartCount: number;
  paymentStatus: PaymentState["status"];
}) {
  const progress = getClientStepProgress({
    cartCount,
    paymentStatus,
    orderStatus: order?.status,
  });

  return (
    <section className={`process-strip ${notice.tone}`} aria-label="Stav procesu objednávky">
      <div className="notice">
        {notice.tone === "danger" ? <Ban size={20} /> : <BadgeCheck size={20} />}
        <div>
          <strong>{notice.title}</strong>
          <span>{notice.detail}</span>
        </div>
      </div>
      <ol className="process-steps">
        {clientStepLabels.map((step, index) => {
          const state = getClientStepState(index, progress);
          return (
            <li
              key={step}
              className={state}
              aria-current={state === "active" || state === "error" ? "step" : undefined}
            >
              <span>{index + 1}</span>
              {step}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CustomerView(props: {
  products: Product[];
  inventory: InventoryItem[];
  reserved: Record<string, number>;
  selectedProduct: Product;
  onSelectProduct: (productId: string) => void;
  draftOptions: ItemOptions;
  setDraftOptions: (options: ItemOptions) => void;
  onAdd: (product: Product) => void;
  cart: CartLine[];
  total: number;
  onQuantity: (lineId: string, delta: number) => void;
  pickupTime: string;
  setPickupTime: (value: string) => void;
  accountMode: "registered" | "guest";
  setAccountMode: (value: "registered" | "guest") => void;
  canSwitchAccountMode: boolean;
  sessionLabel: string;
  payment: PaymentState;
  setPayment: (payment: PaymentState) => void;
  finishPayment: () => void;
  submitOrder: () => void;
  customerOrder?: Order;
}) {
  const {
    products,
    inventory,
    reserved,
    selectedProduct,
    onSelectProduct,
    draftOptions,
    setDraftOptions,
    onAdd,
    cart,
    total,
    onQuantity,
    pickupTime,
    setPickupTime,
    accountMode,
    setAccountMode,
    canSwitchAccountMode,
    sessionLabel,
    payment,
    setPayment,
    finishPayment,
    submitOrder,
    customerOrder,
  } = props;

  return (
    <section className="customer-grid">
      <div className="menu-area">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Aktuální nabídka</p>
            <h2>Předobjednávka</h2>
          </div>
          {canSwitchAccountMode ? (
            <div className="segmented compact" role="group" aria-label="Typ účtu">
              <button
                type="button"
                className={accountMode === "registered" ? "active" : ""}
                onClick={() => setAccountMode("registered")}
              >
                <LogIn size={16} aria-hidden />
                Účet
              </button>
              <button
                type="button"
                className={accountMode === "guest" ? "active" : ""}
                onClick={() => setAccountMode("guest")}
              >
                <User size={16} aria-hidden />
                Host
              </button>
            </div>
          ) : (
            <div className="account-badge">
              <User size={16} aria-hidden />
              {sessionLabel}
            </div>
          )}
        </div>

        <div className="product-grid">
          {products.map((product) => {
            const required = cartConsumption(
              [{ id: "probe", productId: product.id, quantity: 1, options: defaultOptions }],
              products,
            );
            const available = product.available && stockCheck(required, inventory, reserved).ok;

            return (
              <article
                key={product.id}
                className={selectedProduct.id === product.id ? "product-card selected" : "product-card"}
              >
                <div className="product-image">
                  <img src={product.image} alt={product.alt} />
                  {product.badge && <span className="badge">{product.badge}</span>}
                </div>
                <div className="product-copy">
                  <div>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                  </div>
                  <div className="product-actions">
                    <strong>{formatCurrency(product.basePrice)}</strong>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onSelectProduct(product.id)}
                      disabled={!available}
                    >
                      {available ? <Pencil size={16} aria-hidden /> : <Ban size={16} aria-hidden />}
                      {available ? "Vybrat" : "Není"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="order-panel" aria-label="Košík a nastavení objednávky">
        <ProductConfigurator
          product={selectedProduct}
          options={draftOptions}
          setOptions={setDraftOptions}
          onAdd={onAdd}
        />

        <div className="checkout-block">
          <div className="section-heading tight">
            <div>
              <p className="eyebrow">Košík</p>
              <h2>Vyzvednutí</h2>
            </div>
            <select value={pickupTime} onChange={(event) => setPickupTime(event.target.value)}>
              {pickupOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>

          <div className="cart-list">
            {cart.length === 0 && <p className="empty-state">Zatím bez položek.</p>}
            {cart.map((line) => {
              const product = products.find((item) => item.id === line.productId)!;
              return (
                <div className="cart-row" key={line.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{formatOptions(line.options, product.customizable)}</span>
                  </div>
                  <div className="quantity-controls">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onQuantity(line.id, -1)}
                      title="Odebrat kus"
                    >
                      <Minus size={16} aria-hidden />
                    </button>
                    <strong>{line.quantity}</strong>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onQuantity(line.id, 1)}
                      title="Přidat kus"
                    >
                      <Plus size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <PaymentModule
            payment={payment}
            setPayment={setPayment}
            total={total}
            cartHasItems={cart.length > 0}
            finishPayment={finishPayment}
          />

          <div className="total-row">
            <span>Celkem</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <button
            type="button"
            className="primary-button wide"
            onClick={submitOrder}
            disabled={cart.length === 0 || payment.status !== "paid"}
          >
            <CheckCircle2 size={18} aria-hidden />
            Odeslat objednávku
          </button>
        </div>

        <div className="notification-block">
          <div className="mini-heading">
            <Bell size={17} aria-hidden />
            <strong>Notifikace</strong>
          </div>
          {customerOrder ? (
            <CustomerOrderNotification order={customerOrder} />
          ) : (
            <p className="empty-state">Po odeslání se tady zobrazí stav vaší objednávky.</p>
          )}
        </div>
      </aside>
    </section>
  );
}

function CustomerOrderNotification({ order }: { order: Order }) {
  const meta = getCustomerOrderStatus(order.status);
  const Icon = meta.icon;

  return (
    <div className={`customer-order-note ${meta.tone}`} role="status" aria-live="polite">
      <div className="customer-order-head">
        <span className="customer-order-icon">
          <Icon size={18} aria-hidden />
        </span>
        <div>
          <strong>{meta.title}</strong>
          <span>{meta.detail}</span>
        </div>
      </div>

      <div className="customer-order-meta">
        <span>
          <small>Číslo</small>
          <strong>{order.number}</strong>
        </span>
        <span>
          <small>Platba</small>
          <strong>Zaplaceno</strong>
        </span>
        <span>
          <small>Vyzvednutí</small>
          <strong>{order.pickupTime}</strong>
        </span>
        <span>
          <small>Celkem</small>
          <strong>{formatCurrency(order.total)}</strong>
        </span>
      </div>

      <div className="customer-order-lines">
        {order.lines.map((line) => (
          <span key={line.id}>
            {line.quantity}× {line.productName}
          </span>
        ))}
      </div>
    </div>
  );
}

function getCustomerOrderStatus(status: OrderStatus): {
  title: string;
  detail: string;
  tone: "info" | "success" | "danger";
  icon: typeof Clock3;
} {
  switch (status) {
    case "new":
      return {
        title: "Objednávka přijata",
        detail: "Platba proběhla a objednávka čeká na potvrzení obsluhou.",
        tone: "info",
        icon: Clock3,
      };
    case "accepted":
      return {
        title: "Objednávka potvrzena",
        detail: "Obsluha ji převzala a za chvíli ji začne připravovat.",
        tone: "info",
        icon: ClipboardList,
      };
    case "preparing":
      return {
        title: "Objednávka se připravuje",
        detail: "Barista právě připravuje vaši objednávku.",
        tone: "info",
        icon: ChefHat,
      };
    case "ready":
      return {
        title: "Objednávka je hotová",
        detail: "Můžete si ji vyzvednout u obsluhy.",
        tone: "success",
        icon: PackageCheck,
      };
    case "handed":
      return {
        title: "Objednávka vydána",
        detail: "Děkujeme za návštěvu.",
        tone: "success",
        icon: CheckCircle2,
      };
    case "cancelled":
      return {
        title: "Objednávka zrušena",
        detail: "Objednávka nebude připravena. Platbu by bylo potřeba vrátit mimo tento prototyp.",
        tone: "danger",
        icon: Ban,
      };
  }
}

function PaymentModule({
  payment,
  setPayment,
  total,
  cartHasItems,
  finishPayment,
}: {
  payment: PaymentState;
  setPayment: (payment: PaymentState) => void;
  total: number;
  cartHasItems: boolean;
  finishPayment: () => void;
}) {
  function setMethod(method: PaymentMethod) {
    setPayment({ ...payment, method });
  }

  function setField(field: "holderName" | "cardNumber" | "expiry" | "cvc", value: string) {
    setPayment({ ...payment, [field]: value });
  }

  return (
    <section className="payment-panel" aria-label="Platba">
      <div className="mini-heading">
        <CreditCard size={17} aria-hidden />
        <strong>Platba</strong>
      </div>

      <div className="segmented payment-method" role="group" aria-label="Platební metoda">
        <button
          type="button"
          className={payment.method === "card" ? "active" : ""}
          onClick={() => setMethod("card")}
        >
          <CreditCard size={16} aria-hidden />
          Karta
        </button>
        <button
          type="button"
          className={payment.method === "wallet" ? "active" : ""}
          onClick={() => setMethod("wallet")}
        >
          <ShieldCheck size={16} aria-hidden />
          V aplikaci
        </button>
      </div>

      {payment.method === "card" ? (
        <div className="payment-fields">
          <label>
            <span>Držitel karty</span>
            <input
              value={payment.holderName}
              onChange={(event) => setField("holderName", event.target.value)}
              autoComplete="cc-name"
              type="text"
            />
          </label>
          <label>
            <span>Číslo karty</span>
            <input
              value={formatCardNumber(payment.cardNumber)}
              onChange={(event) => setField("cardNumber", event.target.value)}
              autoComplete="cc-number"
              inputMode="numeric"
              maxLength={23}
              type="text"
            />
          </label>
          <div className="payment-field-row">
            <label>
              <span>Platnost</span>
              <input
                value={payment.expiry}
                onChange={(event) => setField("expiry", event.target.value)}
                autoComplete="cc-exp"
                inputMode="numeric"
                maxLength={5}
                type="text"
              />
            </label>
            <label>
              <span>CVC</span>
              <input
                value={payment.cvc}
                onChange={(event) => setField("cvc", event.target.value)}
                autoComplete="cc-csc"
                inputMode="numeric"
                maxLength={4}
                type="password"
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="wallet-summary">
          <ShieldCheck size={18} aria-hidden />
          <div>
            <strong>Kafe karta</strong>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      {payment.error && (
        <div className="payment-message danger" role="alert">
          <Ban size={16} aria-hidden />
          {payment.error}
        </div>
      )}

      {payment.status === "paid" && (
        <div className="payment-message success">
          <CheckCircle2 size={16} aria-hidden />
          <span>Zaplaceno {formatCurrency(total)}</span>
        </div>
      )}

      <button
        className="secondary-button wide"
        type="button"
        onClick={finishPayment}
        disabled={!cartHasItems}
      >
        <CreditCard size={17} aria-hidden />
        Dokončit platbu
      </button>
    </section>
  );
}

function ProductConfigurator({
  product,
  options,
  setOptions,
  onAdd,
}: {
  product: Product;
  options: ItemOptions;
  setOptions: (options: ItemOptions) => void;
  onAdd: (product: Product) => void;
}) {
  const unitPrice = lineUnitPrice(product, options);

  return (
    <div className="configurator">
      <div className="config-image">
        <img src={product.image} alt={product.alt} />
      </div>
      <div className="section-heading tight">
        <div>
          <p className="eyebrow">Personalizace</p>
          <h2>{product.name}</h2>
        </div>
        <strong>{formatCurrency(unitPrice)}</strong>
      </div>

      {product.customizable && (
        <>
          <div className="control-group">
            <span>Velikost</span>
            <div className="segmented" role="group" aria-label="Velikost">
              {sizeOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={options.sizeId === option.id ? "active" : ""}
                  onClick={() => setOptions({ ...options, sizeId: option.id })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <span>Mléko</span>
            <div className="segmented" role="group" aria-label="Mléko">
              {milkOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={options.milkId === option.id ? "active" : ""}
                  onClick={() => setOptions({ ...options, milkId: option.id })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <span>Cukr</span>
            <div className="stepper">
              <button
                type="button"
                className="icon-button"
                onClick={() => setOptions({ ...options, sugar: Math.max(0, options.sugar - 1) })}
                title="Méně cukru"
              >
                <Minus size={16} aria-hidden />
              </button>
              <strong>{options.sugar}</strong>
              <button
                type="button"
                className="icon-button"
                onClick={() => setOptions({ ...options, sugar: Math.min(3, options.sugar + 1) })}
                title="Více cukru"
              >
                <Plus size={16} aria-hidden />
              </button>
            </div>
          </div>
        </>
      )}

      <button type="button" className="primary-button wide" onClick={() => onAdd(product)}>
        <Plus size={18} aria-hidden />
        Přidat do košíku
      </button>
    </div>
  );
}

function StaffView({
  orders,
  setOrderStatus,
}: {
  orders: Order[];
  setOrderStatus: (orderId: string, status: OrderStatus) => void;
}) {
  const columns: Array<{ status: OrderStatus; title: string; icon: typeof Clock3 }> = [
    { status: "new", title: "Nové", icon: Clock3 },
    { status: "accepted", title: "Převzaté", icon: ClipboardList },
    { status: "preparing", title: "V přípravě", icon: ChefHat },
    { status: "ready", title: "Hotovo", icon: PackageCheck },
  ];

  return (
    <section className="staff-board">
      {columns.map((column) => {
        const Icon = column.icon;
        const columnOrders = orders.filter((order) => order.status === column.status);

        return (
          <div className="order-column" key={column.status}>
            <div className="column-heading">
              <Icon size={18} aria-hidden />
              <h2>{column.title}</h2>
              <span>{columnOrders.length}</span>
            </div>
            <div className="order-list">
              {columnOrders.length === 0 && <p className="empty-state">Čisto.</p>}
              {columnOrders.map((order) => (
                <OrderCard key={order.id} order={order} setOrderStatus={setOrderStatus} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function OrderCard({
  order,
  setOrderStatus,
}: {
  order: Order;
  setOrderStatus: (orderId: string, status: OrderStatus) => void;
}) {
  return (
    <article className="order-card">
      <div className="order-card-top">
        <div>
          <strong>{order.number}</strong>
          <span>{order.customerName}</span>
        </div>
        <StatusPill status={order.status} />
      </div>
      <div className="order-meta">
        <span>
          <Timer size={14} aria-hidden />
          {order.pickupTime}
        </span>
        <span>
          <HandCoins size={14} aria-hidden />
          {formatCurrency(order.total)}
        </span>
      </div>
      <ul className="line-list">
        {order.lines.map((line) => (
          <li key={line.id}>
            <span>
              {line.quantity}x {line.productName}
            </span>
            <small>{formatOptions(line.options, true)}</small>
          </li>
        ))}
      </ul>
      <div className="order-actions">
        {order.status === "new" && (
          <button type="button" className="secondary-button" onClick={() => setOrderStatus(order.id, "accepted")}>
            <Check size={16} aria-hidden />
            Převzít
          </button>
        )}
        {order.status === "accepted" && (
          <button type="button" className="secondary-button" onClick={() => setOrderStatus(order.id, "preparing")}>
            <Play size={16} aria-hidden />
            V přípravě
          </button>
        )}
        {order.status === "preparing" && (
          <button type="button" className="secondary-button" onClick={() => setOrderStatus(order.id, "ready")}>
            <CheckCircle2 size={16} aria-hidden />
            Hotovo
          </button>
        )}
        {order.status === "ready" && (
          <button type="button" className="secondary-button" onClick={() => setOrderStatus(order.id, "handed")}>
            <PackageCheck size={16} aria-hidden />
            Vydáno
          </button>
        )}
      </div>
    </article>
  );
}

function InventoryView({
  inventory,
  reserved,
  products,
  onRestock,
  onReportShortage,
  onToggleProduct,
}: {
  inventory: InventoryItem[];
  reserved: Record<string, number>;
  products: Product[];
  onRestock: (ingredientId: string) => void;
  onReportShortage: (ingredientId: string) => void;
  onToggleProduct: (productId: string) => void;
}) {
  return (
    <section className="inventory-grid">
      <div className="inventory-list">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Skladník</p>
            <h2>Zásoby vs. objednávky</h2>
          </div>
          <Package size={24} aria-hidden />
        </div>
        <div className="stock-grid">
          {inventory.map((item) => {
            const reservedAmount = reserved[item.id] ?? 0;
            const available = item.current - reservedAmount;
            const low = available <= item.min;
            const percentage = Math.min(100, Math.max(4, (available / Math.max(item.min * 3, 1)) * 100));

            return (
              <article className={low ? "stock-card low" : "stock-card"} key={item.id}>
                <div className="stock-card-top">
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      Rezervováno {Math.ceil(reservedAmount)} {item.unit}
                    </span>
                  </div>
                  {low ? <AlertTriangle size={20} aria-hidden /> : <CheckCircle2 size={20} aria-hidden />}
                </div>
                <div className="stock-meter" aria-hidden>
                  <span style={{ width: `${percentage}%` }} />
                </div>
                <div className="stock-values">
                  <span>
                    {Math.ceil(available)} {item.unit}
                  </span>
                  <small>minimum {item.min} {item.unit}</small>
                </div>
                <div className="stock-actions">
                  <button type="button" className="icon-button" onClick={() => onRestock(item.id)} title="Doplnit">
                    <Plus size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => onReportShortage(item.id)}
                    title="Nahlásit nedostatek"
                  >
                    <AlertTriangle size={16} aria-hidden />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="availability-panel">
        <div className="section-heading tight">
          <div>
            <p className="eyebrow">Nabídka</p>
            <h2>Dostupnost</h2>
          </div>
          <RefreshCw size={20} aria-hidden />
        </div>
        <div className="toggle-list">
          {products.map((product) => (
            <label className="switch-row" key={product.id}>
              <span>
                <strong>{product.name}</strong>
                <small>{formatCurrency(product.basePrice)}</small>
              </span>
              <input
                type="checkbox"
                checked={product.available}
                onChange={() => onToggleProduct(product.id)}
                aria-label={`Dostupnost ${product.name}`}
              />
            </label>
          ))}
        </div>
      </aside>
    </section>
  );
}

function AdminView({
  products,
  orders,
  revenue,
  onToggleProduct,
  onChangePrice,
}: {
  products: Product[];
  orders: Order[];
  revenue: number;
  onToggleProduct: (productId: string) => void;
  onChangePrice: (productId: string, delta: number) => void;
}) {
  const completed = orders.filter((order) => order.status === "handed").length;
  const average = orders.length ? Math.round(revenue / orders.length) : 0;
  const registeredOrders = orders.filter((order) => order.registered).length;

  return (
    <section className="admin-grid">
      <div className="stats-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Majitelka a vedoucí směny</p>
            <h2>Provozní statistiky</h2>
          </div>
          <Settings size={22} aria-hidden />
        </div>
        <div className="stat-grid">
          <StatTile icon={DollarSign} label="Tržby" value={formatCurrency(revenue)} />
          <StatTile icon={ShoppingBag} label="Objednávky" value={orders.length.toString()} />
          <StatTile icon={PackageCheck} label="Vydáno" value={completed.toString()} />
          <StatTile icon={Star} label="Průměr" value={formatCurrency(average)} />
        </div>
        <div className="priority-band">
          <ListChecks size={20} aria-hidden />
          <div>
            <strong>MoSCoW priorita</strong>
            <span>Objednávky, varianty, platba, fronta obsluhy a stavy objednávky jsou pokryté.</span>
          </div>
        </div>
        <div className="role-grid">
          {[
            ["Klára", "vlastník", "vysoký vliv"],
            ["Jana", "směna", "vysoký zájem"],
            ["Tomáš", "barista", "adopce"],
            ["Ema", "ambasadorka", "testování"],
            ["Mirek", "sklad", "přesnost zásob"],
            ["Zákazníci", "appka", `${registeredOrders} účtů`],
          ].map(([name, role, detail]) => (
            <div className="role-card" key={name}>
              <User size={17} aria-hidden />
              <strong>{name}</strong>
              <span>{role}</span>
              <small>{detail}</small>
            </div>
          ))}
        </div>
      </div>

      <aside className="menu-admin">
        <div className="section-heading tight">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Ceník a nabídka</h2>
          </div>
          <Pencil size={20} aria-hidden />
        </div>
        <div className="price-list">
          {products.map((product) => (
            <div className="price-row" key={product.id}>
              <img src={product.image} alt={product.alt} />
              <div>
                <strong>{product.name}</strong>
                <span>{formatCurrency(product.basePrice)}</span>
              </div>
              <div className="price-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onChangePrice(product.id, -5)}
                  title="Snížit cenu"
                >
                  <Minus size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onChangePrice(product.id, 5)}
                  title="Zvýšit cenu"
                >
                  <Plus size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className={product.available ? "icon-button" : "icon-button danger"}
                  onClick={() => onToggleProduct(product.id)}
                  title="Přepnout dostupnost"
                >
                  {product.available ? <Check size={16} aria-hidden /> : <Ban size={16} aria-hidden />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Coffee; label: string; value: string }) {
  return (
    <div className="stat-tile">
      <Icon size={20} aria-hidden />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const meta = statusMeta[status];
  return <span className={`status-pill ${meta.tone}`}>{meta.label}</span>;
}

function formatOptions(options: ItemOptions, customizable: boolean) {
  if (!customizable) return "bez variant";
  const size = findSize(options.sizeId).label;
  const milk = findMilk(options.milkId).label;
  return `${size}, ${milk}, cukr ${options.sugar}`;
}

function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

export default App;
