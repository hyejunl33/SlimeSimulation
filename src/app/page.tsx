'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import Scene from '../components/Scene';
import { shareToToss } from '../lib/tossSdk'; // We will create this

export default function Home() {
  const router = useRouter();
  const { points, level, addPoints, checkAttendance } = useStore();

  useEffect(() => {
    checkAttendance();
  }, [checkAttendance]);

  const handleShare = async () => {
    // Toss SDK Share
    const shared = await shareToToss('왁뿌볼 만지면서 ASMR 들을 사람?', '지금 토스에서 왁뿌볼을 키워보세요!');
    if (shared) {
      addPoints(100);
      if (typeof window !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
  };

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden flex flex-col items-center justify-between p-6 pb-10">
      <Scene />
      
      <motion.div 
        className="w-full flex justify-between items-start z-10 pt-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold text-gray-900 leading-tight">왁뿌볼</h1>
          <p className="text-[15px] text-gray-500 font-medium tracking-tight">LV.{level} {level === 1 ? '왁스볼' : level === 2 ? '버터볼' : '구슬볼'}</p>
        </div>
        
        <div className="bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-full shadow-sm border border-gray-100 flex items-center gap-1.5 cursor-pointer" onClick={() => router.push('/collection')}>
          <span className="font-bold text-[17px] text-[#3182f6] tracking-tight">{points.toLocaleString()}</span>
          <span className="text-[15px] font-semibold text-gray-400">P</span>
        </div>
      </motion.div>

      <motion.div 
        className="w-full flex flex-col gap-3 z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      >
        <button 
          onClick={() => router.push('/collection')}
          className="w-full h-[56px] bg-[#3182f6] text-white rounded-[16px] font-bold text-[17px] shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center"
        >
          콜렉션 열기 (새로운 왁뿌볼 획득)
        </button>
        <button 
          onClick={handleShare}
          className="w-full h-[56px] bg-white text-[#4e5968] rounded-[16px] font-semibold text-[16px] shadow-sm border border-gray-100 active:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center"
        >
          친구에게 공유하고 100P 받기
        </button>
      </motion.div>
    </main>
  );
}
