'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useStore } from '../../store/useStore';

export default function CollectionPage() {
  const router = useRouter();
  const { points, level, addPoints, levelUp } = useStore();

  const balls = [
    { id: 1, name: '왁스볼', desc: '바삭바삭한 얼음 왁스', cost: 0, unlocked: level >= 1, color: 'bg-blue-100' },
    { id: 2, name: '버터볼', desc: '쭈욱 늘어나는 크리미', cost: 500, unlocked: level >= 2, color: 'bg-yellow-100' },
    { id: 3, name: '구슬볼', desc: '찰랑거리는 유리 비즈', cost: 1500, unlocked: level >= 3, color: 'bg-purple-100' },
  ];

  const handleUnlock = (cost: number, targetLevel: number) => {
    if (points >= cost) {
      addPoints(-cost);
      if (level < targetLevel) {
        levelUp(); // Simple level system logic
      }
    } else {
      alert(`포인트가 부족합니다! (현재 ${points}P / 필요 ${cost}P)`);
    }
  };

  const handleSelect = (id: number) => {
    if (id <= level) {
      useStore.setState({ level: id }); // Select the specific ball
      router.push('/');
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#f9fafb] p-6 pb-10 flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/')} className="text-[24px] text-gray-800">
          ←
        </button>
        <h1 className="text-[20px] font-bold text-gray-900">내 왁뿌볼</h1>
        <div className="bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100 flex items-center gap-1">
          <span className="font-bold text-[15px] text-[#3182f6]">{points.toLocaleString()}</span>
          <span className="text-[13px] text-gray-400">P</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {balls.map((ball, i) => (
          <motion.div 
            key={ball.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`w-full bg-white rounded-[20px] p-5 shadow-sm border ${ball.unlocked ? 'border-gray-200 cursor-pointer' : 'border-gray-100 opacity-60'}`}
            onClick={() => ball.unlocked && handleSelect(ball.id)}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full ${ball.color} flex items-center justify-center shadow-inner`}>
                  {ball.unlocked ? '✨' : '🔒'}
                </div>
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-[18px] font-bold text-gray-900">{ball.name}</h2>
                  <p className="text-[14px] text-gray-500">{ball.desc}</p>
                </div>
              </div>
              
              {!ball.unlocked && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleUnlock(ball.cost, ball.id); }}
                  className="bg-[#3182f6] text-white px-4 py-2 rounded-[12px] font-semibold text-[14px] shadow-sm active:scale-95 transition-transform"
                >
                  {ball.cost}P
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
