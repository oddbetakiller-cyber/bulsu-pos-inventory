// src/pages/StockManagement.jsx
import React, { useState, useEffect } from 'react';
import { rtdb } from '../firebase/firebaseConfig';
import { ref, onValue, push, remove, update, set } from 'firebase/database';
import { AlertTriangle, Plus, Trash2, Edit3, CheckCircle } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const StockManagement = () => {
  const [stocks, setStocks] = useState([]);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [editId, setEditId] = useState(null);
  const [formError, setFormError] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const stocksRef = ref(rtdb, 'stocks');
    onValue(stocksRef, (snapshot) => {
      const data = snapshot.val();
      const list = [];
      for (let id in data || {}) {
        if (id === '__posOperations') continue;
        list.push({ id, ...data[id] });
      }
      setStocks(list);
    });
  }, []);

  const resetForm = () => {
    setName('');
    setSku('');
    setCategory('');
    setPrice('');
    setQuantity('');
    setEditId(null);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanName = name.trim();
    const cleanSku = sku.trim().toUpperCase();
    const cleanCategory = category.trim();
    const numericPrice = Number(price);
    const numericQuantity = Number(quantity);

    if (!cleanName || !cleanSku || !cleanCategory) {
      setFormError('Enter a product name, SKU, and category.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setFormError('Enter a valid unit price.');
      return;
    }
    if (!Number.isInteger(numericQuantity) || numericQuantity < 0) {
      setFormError('Quantity must be a whole number of zero or more.');
      return;
    }

    const duplicateSku = stocks.some(
      (item) => item.id !== editId && (item.sku || '').trim().toUpperCase() === cleanSku
    );
    if (duplicateSku) {
      setFormError('That SKU is already assigned to another product.');
      return;
    }

    const productData = {
      name: cleanName,
      sku: cleanSku,
      category: cleanCategory,
      price: numericPrice,
      quantity: numericQuantity,
    };

    try {
      if (editId) {
        await update(ref(rtdb, `stocks/${editId}`), productData);
      } else {
        await set(push(ref(rtdb, 'stocks')), productData);
      }
      resetForm();
    } catch (error) {
      console.error('Failed to save stock item:', error);
      setFormError('Failed to save this product. Please try again.');
    }
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setName(item.name);
    setSku(item.sku || '');
    setCategory(item.category || '');
    setPrice(item.price);
    setQuantity(item.quantity);
    setFormError('');
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      await remove(ref(rtdb, `stocks/${itemToDelete.id}`));
      if (editId === itemToDelete.id) {
        setEditId(null);
        setName('');
        setSku('');
        setCategory('');
        setPrice('');
        setQuantity('');
      }
    } catch (err) {
      console.error("Failed to delete stock item:", err);
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  const categories = [...new Set(stocks.map((item) => item.category).filter(Boolean))];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-black text-[#8B1E2D] mb-6">Stock & Inventory Management</h1>

      {/* Low Stock Warning Notification */}
      {stocks.some(item => item.quantity <= 5) && (
        <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-900 p-4 rounded-xl shadow mb-6 flex items-center gap-3">
          <AlertTriangle className="text-amber-600" size={24} />
          <div>
            <p className="font-bold">Low Stock Alert Notice!</p>
            <p className="text-sm">You have products with remaining stock of 5 or fewer items.</p>
          </div>
        </div>
      )}

      {/* CRUD Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-md mb-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 items-end border">
        <div className="xl:col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-1">Product Name</label>
          <input type="text" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-[#8B1E2D]" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">SKU</label>
          <input type="text" className="w-full border rounded-xl p-3 uppercase focus:ring-2 focus:ring-[#8B1E2D]" value={sku} onChange={(e) => setSku(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
          <input type="text" list="stock-categories" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-[#8B1E2D]" value={category} onChange={(e) => setCategory(e.target.value)} required />
          <datalist id="stock-categories">
            {categories.map((value) => <option key={value} value={value} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Price (₱)</label>
          <input type="number" min="0" step="0.01" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-[#8B1E2D]" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Quantity</label>
          <input type="number" min="0" step="1" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-[#8B1E2D]" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        {formError && <p className="sm:col-span-2 xl:col-span-6 text-sm font-bold text-red-700">{formError}</p>}
        <div className="sm:col-span-2 xl:col-span-6 flex flex-wrap gap-2">
          <button type="submit" className="bg-[#8B1E2D] hover:bg-[#6c1723] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow">
            {editId ? <CheckCircle size={18} /> : <Plus size={18} />} {editId ? 'Update Product' : 'Add Product'}
          </button>
          {editId && <button type="button" onClick={resetForm} className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-bold text-gray-600 hover:bg-gray-50">Cancel Edit</button>}
        </div>
      </form>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl shadow overflow-hidden border">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#8B1E2D] text-white">
            <tr>
              <th className="p-4">Product Name</th>
              <th className="p-4">SKU</th>
              <th className="p-4">Category</th>
              <th className="p-4">Unit Price</th>
              <th className="p-4">Quantity</th>
              <th className="p-4">Status / Notification</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stocks.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-6 text-center text-gray-500 font-medium">
                  No stock items found.
                </td>
              </tr>
            ) : (
              stocks.map(item => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-bold text-gray-800">{item.name}</td>
                  <td className="p-4 font-mono text-sm text-gray-600">{item.sku || '—'}</td>
                  <td className="p-4 text-gray-600">{item.category || '—'}</td>
                  <td className="p-4 text-gray-600">₱{(Number(item.price) || 0).toFixed(2)}</td>
                  <td className="p-4 font-semibold">{item.quantity}</td>
                  <td className="p-4">
                    {Number(item.quantity) <= 0 ? (
                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black">NO STOCK</span>
                    ) : Number(item.quantity) <= 5 ? (
                      <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-black">LOW STOCK</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">AVAILABLE</span>
                    )}
                  </td>
                  <td className="p-4 flex justify-center gap-2">
                    <button onClick={() => handleEdit(item)} title="Edit Stock" aria-label="Edit Stock" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={18} /></button>
                    <button onClick={() => setItemToDelete(item)} title="Delete Stock" aria-label="Delete Stock" className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(itemToDelete)}
        title="Delete Stock Item"
        message="Are you sure you want to delete this stock item? This action cannot be undone."
        itemName={itemToDelete?.name}
        onConfirm={confirmDelete}
        onCancel={() => setItemToDelete(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default StockManagement;
