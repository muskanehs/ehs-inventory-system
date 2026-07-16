# Economic Hardware Store — User Guide

How to use the inventory system day to day. No technical knowledge needed.

---

## What this system helps you do

- See how much stock you have in the Main Store and each Godown  
- Add new products and receive new stock  
- Move stock between locations, or dispatch to a customer  
- Spot items that are running low  
- See which items are selling/moving fast or slowly  

Open the website link your administrator gave you in a normal browser (Chrome, Edge, etc.).

---

## Who uses what

| Role | What they mainly do |
|------|---------------------|
| **Admin** | Full access — approve transfers, manage godowns, see everything |
| **Store manager** | Dashboard, stock, categories, transfers (cannot approve), activity |
| **Godown manager** | Their godown’s stock and transfers (and can view overall stock) |

You only see the menus your login is allowed to use.

---

## First-time login

1. Open the website.  
2. Enter your **email** and **password**.  
3. Click **Sign in**.

### Default starter accounts (if your admin set these up)

| Email | Starting password |
|--------|-------------------|
| `admin@inventory.local` | `Admin@123` |
| `godown1@inventory.local` | `Godown@123` |
| `godown2@inventory.local` | `Godown@123` |

On first login, the system will ask you to **set a new password**.  
Choose something different from the starting password, then continue.

**Tip:** After you change it, only the new password will work.

---

## Forgot password

1. On the login screen, click **Forgot password**.  
2. Enter the email you use to sign in.  
3. Enter the **OTP code** when asked.  
4. Set your new password, then sign in again.

### Where to find the OTP code

- If your login is a **real email** (like Gmail), check that inbox (and spam).  
- If your login looks like `admin@inventory.local` (starter accounts), that inbox is **not real**.  
  Someone with access to **Brevo** (the email tool used by the store) must log in to Brevo, open the recent password-reset message, and give you the OTP.  
  The code may also arrive in the store’s recovery email (ask your administrator).

The OTP is valid for a short time (about **10 minutes**). If it expires, start Forgot password again.

---

## Moving around the app

After login you’ll see a menu on the side (or similar navigation):

| Menu | Use it for |
|------|------------|
| **Dashboard** | Quick overview of stock health |
| **Stock** | All products and quantities |
| **Categories** | Group products (e.g. Grocery, Hardware) |
| **Transfers** | Move stock or send to customers |
| **Activity** | History of stock changes and transfers |
| **Godowns** | Manage godown names (Admin only) |

Use the **search box at the top** to find products by name or code across the system.

To leave the system safely, use **Sign out**.

---

## Dashboard

Best starting point for Admin / Store manager.

You’ll see:

- How many products you have  
- Total stock units  
- How many items are **low stock**  
- How many transfers are waiting for approval  

### Three lists at the bottom

1. **Low stock** — needs restocking soon  
2. **Fast-moving** — moved a lot recently  
3. **Slow-moving** — barely moved, still has stock  

Each list shows a few items. Click **View more** to open the full Stock page with that filter already applied.

---

## Stock page

This is your main product list.

### What you can do

- Browse products and expand a row to see stock **per location**  
- **Add Product** — create a new item (Admin / Store manager)  
- **Add Stock** — receive stock into a location  
- **Export** — download stock data  
- Use the filter next to Export:
  - **All stock**  
  - **Low stock**  
  - **Fast moving**  
  - **Slow moving**  

### Godown managers

You may see a switch:

- **My Godown** — only your assigned godown  
- **Overall Stock** — all locations  

### Status labels (examples)

| Label | Meaning |
|-------|---------|
| Healthy | Above minimum level |
| Low stock | At or below minimum |
| Out of stock | Zero quantity |
| Inactive | Product turned off |

---

## Categories

Use this to organise products into groups (for example Hardware, Paint, Electrical).

1. Open **Categories**.  
2. Add or edit a category name and description.  
3. When you create products later, pick the right category.

---

## Godowns (Admin)

1. Open **Godowns**.  
2. Create a new godown or rename an existing one.  
3. Godown managers are usually assigned to one of these locations by your administrator.

---

## Transfers

Use transfers whenever goods leave one place and go to another.

### Two types

| Type | When to use |
|------|-------------|
| **Internal** | Main Store ↔ Godown, or godown to godown |
| **Customer** | Sending goods out to a customer |

### Typical steps

1. Open **Transfers**.  
2. Create a transfer — choose type, locations (or customer details), products, and quantities.  
3. The transfer stays **Pending** until an **Admin** approves it.  
4. After approval, stock levels update automatically.  
5. Print or download the slip if needed:
   - **Transfer slip** for internal moves  
   - **Dispatch slip** for customer deliveries  

Admins can also use **Approve All** when many pending transfers should be approved together (you’ll be asked to confirm).

---

## Activity

Open **Activity** to see a dated history of:

- Stock that was added or adjusted  
- Transfers that happened  

Useful when you need to check “what changed and when.”

---

## Fast-moving and slow-moving (in plain words)

The system looks at roughly the **last 60 days** of movement:

- **Fast-moving** — items that moved often (busy sellers / busy movers)  
- **Slow-moving** — items that moved little but still sit in stock  

These lists refresh automatically overnight (around **2:00 AM**). You don’t need to do anything.

Use them on the Dashboard, or on Stock with the Fast / Slow filter.

---

## Common day-to-day tasks

### Receive new stock

1. Go to **Stock**.  
2. Click **Add Stock**.  
3. Choose product, location, and quantity.  
4. Save.

### Create a new product

1. Go to **Stock**.  
2. Click **Add Product**.  
3. Fill name, code (SKU), category, unit, and minimum stock level.  
4. Save, then add stock when goods arrive.

### Move stock from Godown to Main Store

1. Go to **Transfers**.  
2. Create an **Internal** transfer (from godown → Main Store).  
3. Ask Admin to **Approve**.  
4. Print the transfer slip if needed.

### Send stock to a customer

1. Go to **Transfers**.  
2. Create a **Customer** transfer with customer details and items.  
3. Admin approves.  
4. Print the **dispatch slip**.

### Check what needs restocking

1. Open **Dashboard** → Low stock, or  
2. Open **Stock** → filter **Low stock**.

---

## Password tips

- Change the starter password on first login.  
- Don’t share your password.  
- If you forget it, use **Forgot password** (see earlier section).  
- For starter `@inventory.local` accounts, ask the person who manages Brevo for the OTP.

---

## If something doesn’t work

| What you see | What to try |
|--------------|-------------|
| Can’t sign in | Check email/password; try Forgot password |
| Asked to change password again and again | Set a password that is **different** from the old one |
| Forgot password but no code | Wait a minute; check spam; for starter accounts, ask admin to check **Brevo** |
| Empty stock lists | Ask admin whether products/stock were set up yet |
| Transfer stuck on Pending | An Admin must approve it |
| Menu item missing | Your login role may not include that screen — ask Admin |

If nothing helps, contact your system administrator with:

- What you were trying to do  
- The exact message on screen  
- Which login email you used  

---

## Quick reminder

| Want to… | Go to… |
|----------|--------|
| See overview | Dashboard |
| Find / manage products | Stock |
| Restock alerts | Dashboard or Stock → Low stock |
| Move goods | Transfers |
| See history | Activity |
| Manage locations | Godowns (Admin) |
| Reset password | Login → Forgot password → Brevo/admin for starter accounts |

---

*Economic Hardware Store inventory system — end-user guide.*
