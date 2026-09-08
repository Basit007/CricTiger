import React, { useState, useEffect } from 'react';
import { SavedTeam, TeamAccount } from '../types';
import { getSavedTeams, saveTeam, deleteTeam } from '../utils/storage';
import { Plus, Trash2, Edit2, ArrowLeft, Save, Users, Upload, Star, Shield } from 'lucide-react';

interface Props {
  currentAccount: TeamAccount;
  onBack: () => void;
}

export const TeamManager: React.FC<Props> = ({ currentAccount, onBack }) => {
  const [teams, setTeams] = useState<SavedTeam[]>([]);
  const [editingTeam, setEditingTeam] = useState<SavedTeam | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [squadText, setSquadText] = useState('');

  useEffect(() => {
    loadTeams();
  }, [currentAccount]);

  const loadTeams = () => {
    setTeams(getSavedTeams(currentAccount.id));
  };

  const handleCreateNew = () => {
    setEditingTeam({
      id: Date.now().toString(),
      name: '',
      logoUrl: '',
      squad: []
    });
    setName('');
    setLogoUrl('');
    setSquadText('');
  };

  const handleEdit = (team: SavedTeam) => {
    setEditingTeam(team);
    setName(team.name);
    setLogoUrl(team.logoUrl || '');
    setSquadText(team.squad.join('\n'));
  };

  const handleDelete = (id: string, teamName: string) => {
    if (teamName.toLowerCase() === currentAccount.teamName.toLowerCase()) {
      alert("This is your primary registered team and cannot be deleted.");
      return;
    }
    if (confirm(`Are you sure you want to delete ${teamName}?`)) {
      deleteTeam(id, currentAccount.id);
      loadTeams();
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert("Image is too large. Please upload a logo smaller than 500KB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return alert("Team name is required");
    
    const squadList = squadText.split('\n').map(s => s.trim()).filter(s => s !== '');
    if (squadList.length < 11) return alert("Please add at least 11 players to the squad.");

    const newTeam: SavedTeam = {
      id: editingTeam?.id || Date.now().toString(),
      name: name.trim(),
      logoUrl,
      squad: squadList
    };

    saveTeam(newTeam, currentAccount.id);
    loadTeams();
    setEditingTeam(null);
  };

  if (editingTeam) {
    const isPrimary = editingTeam.name.toLowerCase() === currentAccount.teamName.toLowerCase();

    return (
      <div className="flex flex-col h-full bg-tiger-black text-white p-4 sm:p-6 overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setEditingTeam(null)} className="p-2 rounded-full hover:bg-gray-800">
             <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-tiger-gold">
              {editingTeam.name ? (isPrimary ? `Edit Your Team: ${editingTeam.name}` : `Edit Opponent: ${editingTeam.name}`) : 'Add Opponent Team'}
            </h2>
            <p className="text-xs text-gray-400">Scoped to {currentAccount.teamName} club database</p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl mx-auto w-full">
           <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Team Name</label>
                <input 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 outline-none focus:border-tiger-gold text-sm"
                  placeholder="e.g. Islamabad XI or Karachi Kings"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Team Logo / Emblem</label>
                <div className="flex flex-col gap-4">
                   <div className="flex gap-2">
                      <input 
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 outline-none focus:border-tiger-gold text-sm"
                        placeholder="Paste image URL or emoji..."
                      />
                      <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white px-4 rounded-lg flex items-center gap-2 transition-colors border border-gray-600">
                         <Upload size={18} />
                         <span className="text-xs font-bold uppercase hidden sm:inline">Upload</span>
                         <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                      </label>
                   </div>

                   {logoUrl && (
                     <div className="flex items-center gap-4 bg-gray-900/50 p-3 rounded-xl border border-gray-700/50">
                        <div className="w-16 h-16 rounded-full bg-black overflow-hidden border-2 border-tiger-gold shadow-lg flex-shrink-0 flex items-center justify-center text-2xl">
                           {logoUrl.length < 5 ? logoUrl : (
                             <img src={logoUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                           )}
                        </div>
                        <div className="flex-1">
                           <p className="font-bold text-white text-sm">Logo Preview</p>
                           <p className="text-xs text-gray-500 mt-0.5">Visible on scorecard, match setup, and statistics.</p>
                           <button onClick={() => setLogoUrl('')} className="text-red-400 hover:text-red-300 text-xs font-bold mt-1.5 uppercase flex items-center gap-1">
                              <Trash2 size={12} /> Remove
                           </button>
                        </div>
                     </div>
                   )}
                </div>
              </div>
           </div>

           <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 h-96 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Squad List (One player per line)
                </label>
                <span className="text-xs text-tiger-gold font-bold px-2 py-0.5 rounded bg-tiger-gold/10">
                  {squadText.split('\n').filter(s => s.trim()).length} Players
                </span>
              </div>
              <textarea 
                value={squadText}
                onChange={(e) => setSquadText(e.target.value)}
                className="flex-1 w-full bg-gray-900 border border-gray-600 rounded-lg p-3 outline-none focus:border-tiger-gold font-mono text-sm leading-relaxed resize-none"
                placeholder={`Player 1\nPlayer 2\nPlayer 3...`}
              />
           </div>

           <button 
             onClick={handleSave}
             className="w-full py-4 bg-gradient-to-r from-tiger-gold to-tiger-orange text-black font-black uppercase rounded-xl shadow-lg flex items-center justify-center gap-2 hover:brightness-110"
           >
             <Save size={20} /> Save Squad
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-tiger-black text-white p-4 sm:p-6 overflow-y-auto no-scrollbar">
      <div className="flex items-center justify-between mb-4">
         <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-800">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white">Manage Squads & Teams</h2>
              <p className="text-xs text-gray-400">Club: <span className="text-tiger-gold font-semibold">{currentAccount.teamName}</span></p>
            </div>
         </div>
         <button 
           onClick={handleCreateNew}
           className="bg-tiger-gold text-black px-3.5 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 hover:bg-yellow-400 shadow-md"
         >
           <Plus size={15} /> Add Opponent
         </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
         {teams.map(team => {
           const isPrimary = team.name.toLowerCase() === currentAccount.teamName.toLowerCase();
           return (
             <div 
               key={team.id} 
               className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                 isPrimary 
                   ? 'bg-gray-900/90 border-tiger-gold/60 shadow-[0_0_15px_rgba(251,191,36,0.1)]' 
                   : 'bg-gray-800/80 border-gray-700 hover:border-gray-600'
               }`}
             >
                <div className="flex items-center gap-3.5 overflow-hidden">
                   <div className="w-14 h-14 rounded-full bg-black border-2 border-gray-600 flex items-center justify-center overflow-hidden text-2xl flex-shrink-0">
                      {team.logoUrl ? (
                        team.logoUrl.length < 5 ? team.logoUrl : <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="text-gray-500" size={24} />
                      )}
                   </div>
                   <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-black text-white text-base truncate">{team.name}</h3>
                        {isPrimary && (
                          <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-tiger-gold text-black font-black uppercase">
                            Your Club
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{team.squad.length} Players in Squad</p>
                   </div>
                </div>

                <div className="flex gap-1.5 flex-shrink-0">
                   <button 
                     onClick={() => handleEdit(team)} 
                     className="p-2 rounded-lg bg-gray-700/80 hover:bg-gray-600 text-blue-400 transition-all"
                     title="Edit Squad"
                   >
                     <Edit2 size={16} />
                   </button>
                   {!isPrimary && (
                     <button 
                       onClick={() => handleDelete(team.id, team.name)} 
                       className="p-2 rounded-lg bg-gray-700/80 hover:bg-red-900/40 text-red-400 transition-all"
                       title="Delete Opponent"
                     >
                       <Trash2 size={16} />
                     </button>
                   )}
                </div>
             </div>
           );
         })}
      </div>
    </div>
  );
};
