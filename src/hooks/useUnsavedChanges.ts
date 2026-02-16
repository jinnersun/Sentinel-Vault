import { useEffect, useRef } from 'react';

export type UnsavedAction = 'save' | 'discard' | 'cancel';

interface UseUnsavedChangesOptions {
  isDirty: boolean;
}

export function useUnsavedChanges({ isDirty }: UseUnsavedChangesOptions) {
  const isDirtyRef = useRef(isDirty);
  
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // 页面关闭/刷新前的提示（浏览器原生）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return { isDirtyRef };
}

// 显示自定义确认对话框
export function showUnsavedDialog(message: string = '您有未保存的更改'): Promise<UnsavedAction> {
  return new Promise((resolve) => {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]';
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'bg-surface border border-surface2 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl';
    
    dialog.innerHTML = `
      <h3 class="text-lg font-bold text-text mb-2">${message}</h3>
      <p class="text-text2 mb-6">您想要保存更改吗？</p>
      <div class="flex justify-end space-x-3">
        <button id="unsaved-cancel" class="px-4 py-2 bg-surface2 hover:bg-surface text-text rounded-lg transition-colors">取消</button>
        <button id="unsaved-discard" class="px-4 py-2 bg-surface2 hover:bg-surface text-error rounded-lg transition-colors">不保存</button>
        <button id="unsaved-save" class="px-4 py-2 bg-accent hover:bg-accent2 text-white rounded-lg transition-colors">保存</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 绑定事件
    const saveBtn = dialog.querySelector('#unsaved-save') as HTMLButtonElement;
    const discardBtn = dialog.querySelector('#unsaved-discard') as HTMLButtonElement;
    const cancelBtn = dialog.querySelector('#unsaved-cancel') as HTMLButtonElement;
    
    const cleanup = () => {
      document.body.removeChild(overlay);
    };
    
    saveBtn.onclick = () => {
      cleanup();
      resolve('save');
    };
    
    discardBtn.onclick = () => {
      cleanup();
      resolve('discard');
    };
    
    cancelBtn.onclick = () => {
      cleanup();
      resolve('cancel');
    };
    
    // 点击遮罩层关闭
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve('cancel');
      }
    };
    
    // ESC 键关闭
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve('cancel');
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}
