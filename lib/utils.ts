import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely copies text to clipboard with fallback for environments 
 * where Clipboard API is not available
 */
export const copyToClipboard = (text: string): boolean => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return false;
    }
    
    // Modern clipboard API method
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback method using document.execCommand
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
}
