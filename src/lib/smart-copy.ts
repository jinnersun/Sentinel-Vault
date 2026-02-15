import { generateEnvFormat, generateJsonFormat } from './utils';

export interface CopyFormat {
  type: 'raw' | 'env' | 'json' | 'custom';
  template?: string;
}

export class SmartCopyManager {
  private static instance: SmartCopyManager;
  private copyHistory: Array<{ text: string; timestamp: Date; format: string }> = [];
  private maxHistorySize = 10;

  static getInstance(): SmartCopyManager {
    if (!SmartCopyManager.instance) {
      SmartCopyManager.instance = new SmartCopyManager();
    }
    return SmartCopyManager.instance;
  }

  async copyText(text: string, format: CopyFormat): Promise<void> {
    let textToCopy = '';

    switch (format.type) {
      case 'raw':
        textToCopy = text;
        break;
      case 'env':
        const key = this.generateKeyFromText(text);
        textToCopy = generateEnvFormat(key, text);
        break;
      case 'json':
        textToCopy = generateJsonFormat('api_key', text);
        break;
      case 'custom':
        if (format.template) {
          textToCopy = format.template
            .replace('{key}', this.generateKeyFromText(text))
            .replace('{value}', text)
            .replace('{timestamp}', new Date().toISOString());
        } else {
          textToCopy = text;
        }
        break;
      default:
        textToCopy = text;
    }

    try {
      await this.performCopy(textToCopy);
      this.addToHistory(textToCopy, format.type);
      this.showVisualFeedback();
    } catch (error) {
      console.error('Failed to copy text:', error);
      throw error;
    }
  }

  private async performCopy(text: string): Promise<void> {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  private generateKeyFromText(text: string): string {
    // Simple key generation - in a real app, this would be more sophisticated
    const commonPatterns = {
      'openai': 'OPENAI_API_KEY',
      'anthropic': 'ANTHROPIC_API_KEY',
      'github': 'GITHUB_TOKEN',
      'aws': 'AWS_ACCESS_KEY',
      'google': 'GOOGLE_API_KEY',
      'stripe': 'STRIPE_API_KEY',
      'database': 'DATABASE_URL',
      'redis': 'REDIS_URL',
    };

    const lowerText = text.toLowerCase();
    for (const [pattern, key] of Object.entries(commonPatterns)) {
      if (lowerText.includes(pattern)) {
        return key;
      }
    }

    return 'API_KEY';
  }

  private addToHistory(text: string, format: string): void {
    this.copyHistory.unshift({
      text: text.length > 50 ? text.substring(0, 50) + '...' : text,
      timestamp: new Date(),
      format
    });

    if (this.copyHistory.length > this.maxHistorySize) {
      this.copyHistory.pop();
    }
  }

  private showVisualFeedback(): void {
    // Create visual feedback element
    const feedback = document.createElement('div');
    feedback.className = 'fixed top-4 right-4 bg-success text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in';
    feedback.innerHTML = `
      <div class="flex items-center space-x-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>已复制到剪贴板</span>
      </div>
    `;
    
    document.body.appendChild(feedback);
    
    // Auto remove after 2 seconds
    setTimeout(() => {
      feedback.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => {
        if (feedback.parentNode) {
          document.body.removeChild(feedback);
        }
      }, 300);
    }, 2000);
  }

  getCopyHistory(): Array<{ text: string; timestamp: Date; format: string }> {
    return [...this.copyHistory];
  }

  clearHistory(): void {
    this.copyHistory = [];
  }
}

export const smartCopy = SmartCopyManager.getInstance();

export const predefinedFormats: CopyFormat[] = [
  { type: 'raw' },
  { type: 'env' },
  { type: 'json' },
  { type: 'custom', template: 'export {key}="{value}"' },
  { type: 'custom', template: 'const {key} = "{value}";' },
  { type: 'custom', template: '{key}: "{value}"' },
];