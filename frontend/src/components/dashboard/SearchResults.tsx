import React, { type JSX } from "react";
import { formatDistanceToNow } from "date-fns";
import {
    Mail,
    Loader2,
    X,
    Star,
    Paperclip,
    ArrowLeft,
    Search,
} from "lucide-react";
import type { Email } from "../../types";

interface SearchResultsProps {
    query: string;
    results: Email[];
    loading: boolean;
    error: string | null;
    onSelectEmail: (email: Email) => void;
    onClose: () => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
    query,
    results,
    loading,
    error,
    onSelectEmail,
    onClose,
}) => {
    const highlightText = (text: string, query: string): JSX.Element => {
        if (!query.trim()) return <>{text}</>;

        const parts = text.split(new RegExp(`(${query})`, "gi"));
        return (
            <>
                {parts.map((part, index) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <mark key={index} className="bg-yellow-200 font-semibold">
                            {part}
                        </mark>
                    ) : (
                        <span key={index}>{part}</span>
                    )
                )}
            </>
        );
    };

    return (
        <div className="flex-1 flex flex-col bg-white border-r border-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Back to emails"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className="flex items-center gap-2">
                            <Search className="w-5 h-5 text-primary-600" />
                            <h2 className="text-lg font-semibold text-gray-800">
                                Search Results
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Close search"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="text-sm text-gray-600">
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Searching...
                        </span>
                    ) : (
                        <span>
                            Found <strong>{results.length}</strong> result
                            {results.length !== 1 ? "s" : ""} for{" "}
                            <strong>"{query}"</strong>
                        </span>
                    )}
                </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
                            <p className="text-gray-500">Searching emails...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-64 text-red-500 p-8">
                        <Mail className="w-16 h-16 mb-4 text-red-300" />
                        <p className="text-lg font-medium">Search Error</p>
                        <p className="text-sm text-gray-500 mt-1">{error}</p>
                    </div>
                ) : results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 p-8">
                        <Search className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No results found</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Try different keywords or check spelling
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {results.map((email) => (
                            <div
                                key={email.id}
                                onClick={() => onSelectEmail(email)}
                                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Star Icon */}
                                    <div className="mt-1">
                                        {email.isStarred ? (
                                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                        ) : (
                                            <Star className="w-4 h-4 text-gray-300" />
                                        )}
                                    </div>

                                    {/* Email Content */}
                                    <div className="flex-1 min-w-0">
                                        {/* From */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <span
                                                className={`font-medium ${email.isRead ? "text-gray-700" : "text-gray-900"
                                                    }`}
                                            >
                                                {highlightText(email.from.name, query)}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {highlightText(email.from.email, query)}
                                            </span>
                                        </div>

                                        {/* Subject */}
                                        <div
                                            className={`font-medium mb-1 ${email.isRead ? "text-gray-600" : "text-gray-900"
                                                }`}
                                        >
                                            {highlightText(email.subject, query)}
                                        </div>

                                        {/* Preview/Snippet */}
                                        <div className="text-sm text-gray-500 line-clamp-2 mb-2">
                                            {highlightText(email.preview, query)}
                                        </div>

                                        {/* Metadata */}
                                        <div className="flex items-center gap-3 text-xs text-gray-400">
                                            <span>
                                                {formatDistanceToNow(new Date(email.timestamp), {
                                                    addSuffix: true,
                                                })}
                                            </span>
                                            {email.attachments && email.attachments.length > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <Paperclip className="w-3 h-3" />
                                                    <span>{email.attachments.length}</span>
                                                </div>
                                            )}
                                            {!email.isRead && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    Unread
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* View Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectEmail(email);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg"
                                    >
                                        View
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchResults;
