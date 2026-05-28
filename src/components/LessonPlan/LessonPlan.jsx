import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Maximize2, Upload, LoaderCircle, Image as ImageIcon } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';

export default function LessonPlan() {
  const { user } = useAuth();
  const { can, isVisible, loading: permsLoading } = usePermissions();
  
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fullScreenImg, setFullScreenImg] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/lesson-plans/${user.institutionId}`);
      const data = await res.json();
      setPlans(data);
    } catch (e) {
      console.error("Failed to fetch lesson plans", e);
    }
    setLoading(false);
  }, [user.institutionId]);

  useEffect(() => {
    if (isVisible('LessonPlan')) fetchPlans();
  }, [fetchPlans, isVisible]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert("Image must be under 5MB");

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!preview) return alert("Please select an image");

    setUploading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/lesson-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          image_data: preview,
          title: title
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setPreview(null);
        setTitle('');
        fetchPlans();
      }
    } catch (e) {
      alert("Upload failed");
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this lesson plan?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/lesson-plans/${id}`, { method: 'DELETE' });
      if (res.ok) fetchPlans();
    } catch (e) {
      alert("Delete failed");
    }
  };

  if (permsLoading || loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <LoaderCircle className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!isVisible('LessonPlan')) {
    return (
      <div className="p-10 text-center text-slate-500 font-medium italic">
        You do not have permission to view this module.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Lesson Plans</h2>
          <p className="text-slate-400 text-sm font-medium">Upload and manage visual lesson structures.</p>
        </div>
        {can('LessonPlan', 'edit') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 transition-all"
          >
            <Plus size={18} /> Upload Plan
          </button>
        )}
      </div>

      {/* Grid */}
      {plans.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-100 rounded-[2rem] p-20 text-center">
          <ImageIcon className="mx-auto text-slate-200 mb-4" size={48} />
          <p className="text-slate-400 font-medium">No lesson plans uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className="group bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all relative">
              <div className="aspect-[3/4] overflow-hidden relative">
                <img 
                  src={plan.image_data} 
                  alt={plan.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button 
                    onClick={() => setFullScreenImg(plan)}
                    className="p-3 bg-white rounded-2xl text-slate-900 hover:bg-blue-600 hover:text-white transition-all shadow-xl"
                  >
                    <Maximize2 size={20} />
                  </button>
                  {can('LessonPlan', 'delete') && (
                    <button 
                      onClick={() => handleDelete(plan.id)}
                      className="p-3 bg-white rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xl"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>
              <div className="p-4 bg-white border-t border-slate-50">
                <h4 className="font-bold text-slate-700 truncate">{plan.title}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                  {new Date(plan.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-6 text-slate-800">Upload Lesson Plan</h2>
            
            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Plan Title</label>
                <input 
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Science - Chapter 1 Structure"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Image File</label>
                {!preview ? (
                  <label className="flex flex-col items-center justify-center w-full h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all">
                    <Upload className="text-slate-300 mb-2" size={32} />
                    <span className="text-xs font-bold text-slate-400">Click to Browse</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden h-48 border border-slate-100">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => setPreview(null)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                disabled={uploading}
                className="w-full bg-slate-900 hover:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2"
              >
                {uploading ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />}
                {uploading ? 'Uploading...' : 'Add to Collection'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Full Screen View */}
      {fullScreenImg && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
            <h3 className="text-white font-black text-xl">{fullScreenImg.title}</h3>
            <button 
              onClick={() => setFullScreenImg(null)}
              className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-md transition-all"
            >
              <X size={24} />
            </button>
          </div>
          <img 
            src={fullScreenImg.image_data} 
            alt="Full view" 
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}