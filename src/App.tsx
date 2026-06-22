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
  ListChecks,
  LogIn,
  Minus,
  Package,
  PackageCheck,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Settings,
  ShoppingBag,
  Star,
  Timer,
  User,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import type { CartLine, InventoryItem, ItemOptions, Order, OrderStatus, Product, RoleKey } from "./types";

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
  const [activeRole, setActiveRole] = useState<RoleKey>("customer");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [orders, setOrders] = useState<Order[]>(seedOrders);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(initialProducts[0].id);
  const [draftOptions, setDraftOptions] = useState<ItemOptions>(defaultOptions);
  const [pickupTime, setPickupTime] = useState("09:30");
  const [accountMode, setAccountMode] = useState<"registered" | "guest">("registered");
  const [paymentMode, setPaymentMode] = useState<"success" | "failure">("success");
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
  const latestOrder = orders[0];
  const readyOrders = orders.filter((order) => order.status === "ready");
  const activeOrders = orders.filter((order) => !["handed", "cancelled"].includes(order.status));
  const paidRevenue = orders
    .filter((order) => order.paymentStatus === "paid" && order.status !== "cancelled")
    .reduce((sum, order) => sum + order.total, 0);
  const lowStockCount = inventory.filter((item) => item.current - (reserved[item.id] ?? 0) <= item.min).length;

  function addToCart(product: Product) {
    const options = product.customizable ? draftOptions : defaultOptions;
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
    setCart((current) =>
      current
        .map((line) => (line.id === lineId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function submitOrder() {
    if (cart.length === 0) {
      setNotice({
        tone: "warning",
        title: "Košík je prázdný",
        detail: "Vyberte alespoň jednu položku z nabídky.",
      });
      return;
    }

    if (paymentMode === "failure") {
      setNotice({
        tone: "danger",
        title: "Platba selhala",
        detail: "Objednávka byla zastavena a zákazníkovi se nabízí opakování platby.",
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

    const order = createOrder({
      cart,
      products,
      number: nextOrderNumber,
      customerName: accountMode === "registered" ? customerName : "Host",
      registered: accountMode === "registered",
      pickupTime,
    });

    setOrders((current) => [order, ...current]);
    setNextOrderNumber((current) => current + 1);
    setCart([]);
    setNotice({
      tone: "success",
      title: `Objednávka ${order.number} přijata`,
      detail: `Platba proběhla a objednávka čeká na obsluhu pro vyzvednutí v ${pickupTime}.`,
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
          <Metric icon={ClipboardList} label="Aktivní" value={activeOrders.length.toString()} />
          <Metric icon={DollarSign} label="Tržby" value={formatCurrency(paidRevenue)} />
          <Metric icon={AlertTriangle} label="Nízké zásoby" value={lowStockCount.toString()} />
          <Metric icon={Heart} label="Body" value={loyaltyPoints.toString()} />
        </div>
      </header>

      <main className="workspace">
        <nav className="role-tabs" aria-label="Role aplikace">
          {roleTabs.map((tab) => {
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

        <ProcessStrip order={latestOrder} notice={notice} />

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
            accountMode={accountMode}
            setAccountMode={setAccountMode}
            paymentMode={paymentMode}
            setPaymentMode={setPaymentMode}
            submitOrder={submitOrder}
            readyOrders={readyOrders}
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

function Metric({ icon: Icon, label, value }: { icon: typeof Coffee; label: string; value: string }) {
  return (
    <div className="metric">
      <Icon size={17} aria-hidden />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProcessStrip({ order, notice }: { order?: Order; notice: Notice }) {
  const steps = ["Účet", "Nabídka", "Platba", "Sklad", "Obsluha", "Příprava", "Notifikace", "Vyzvednutí"];
  const statusIndex: Record<OrderStatus, number> = {
    new: 4,
    accepted: 4,
    preparing: 5,
    ready: 6,
    handed: 7,
    cancelled: 2,
  };
  const currentIndex = order ? statusIndex[order.status] : 1;

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
        {steps.map((step, index) => (
          <li key={step} className={index <= currentIndex ? "done" : ""}>
            <span>{index + 1}</span>
            {step}
          </li>
        ))}
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
  paymentMode: "success" | "failure";
  setPaymentMode: (value: "success" | "failure") => void;
  submitOrder: () => void;
  readyOrders: Order[];
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
    paymentMode,
    setPaymentMode,
    submitOrder,
    readyOrders,
  } = props;

  return (
    <section className="customer-grid">
      <div className="menu-area">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Aktuální nabídka</p>
            <h2>Předobjednávka</h2>
          </div>
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

          <div className="segmented payment-mode" role="group" aria-label="Simulace platby">
            <button
              type="button"
              className={paymentMode === "success" ? "active" : ""}
              onClick={() => setPaymentMode("success")}
            >
              <CreditCard size={16} aria-hidden />
              Platba OK
            </button>
            <button
              type="button"
              className={paymentMode === "failure" ? "active danger" : ""}
              onClick={() => setPaymentMode("failure")}
            >
              <Ban size={16} aria-hidden />
              Selhání
            </button>
          </div>

          <div className="total-row">
            <span>Celkem</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <button type="button" className="primary-button wide" onClick={submitOrder}>
            <CreditCard size={18} aria-hidden />
            Zaplatit a odeslat
          </button>
        </div>

        <div className="notification-block">
          <div className="mini-heading">
            <Bell size={17} aria-hidden />
            <strong>Notifikace</strong>
          </div>
          {readyOrders.length === 0 ? (
            <p className="empty-state">Žádná hotová objednávka.</p>
          ) : (
            readyOrders.map((order) => (
              <div className="ready-note" key={order.id}>
                <CheckCircle2 size={17} aria-hidden />
                <span>{order.number} je připravena k vyzvednutí.</span>
              </div>
            ))
          )}
        </div>
      </aside>
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

export default App;
