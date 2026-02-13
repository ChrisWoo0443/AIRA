import { AiOutlineFilePdf, AiOutlineFileText, AiOutlineFileMarkdown, AiOutlineFile } from 'react-icons/ai';

interface FileTypeIconProps {
  filename: string;
  className?: string;
}

export function FileTypeIcon({ filename, className = 'text-base' }: FileTypeIconProps) {
  const extension = filename.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return <AiOutlineFilePdf className={`${className} text-red-600`} />;
    case 'md':
      return <AiOutlineFileMarkdown className={`${className} text-indigo-500`} />;
    case 'txt':
      return <AiOutlineFileText className={`${className} text-gray-500`} />;
    default:
      return <AiOutlineFile className={`${className} text-gray-400`} />;
  }
}
