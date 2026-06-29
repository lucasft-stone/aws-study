import React from 'react';

export default function StudyBot({ status = 'idle', className = '' }) {
    const statusProps = {
        idle: { eyeY: 0, mouth: "M 43 70 C 47 73, 53 73, 57 70", pupilX: 0, pupilY: 0, earRotate: 0 },
        loading: { eyeY: 0, mouth: "M 48 70 Q 50 68 52 70", pupilX: 0, pupilY: 0, earRotate: 0 },
        correct: { eyeY: -2, mouth: "M 40 68 C 45 80, 55 80, 60 68", pupilX: 0, pupilY: -1, earRotate: -5 },
        incorrect: { eyeY: 2, mouth: "M 43 72 C 47 68, 53 68, 57 72", pupilX: 0, pupilY: 1, earRotate: 5 },
    };
    const currentStatus = statusProps[status] || statusProps.idle;
    return (
        <div className={`w-32 h-32 mx-auto mb-4 transition-transform duration-500 transform ${status === 'correct' ? 'scale-110' : ''} ${className}`}>
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="botBodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <linearGradient id="innerEarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#c4b5fd" />
                        <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.15" />
                    </filter>
                </defs>
                
                <g filter="url(#shadow)">
                    <path d="M 50,95 C 25,95 15,75 15,50 C 15,25 25,10 50,10 C 75,10 85,25 85,50 C 85,75 75,95 50,95 Z" fill="url(#botBodyGradient)" />
                    <g style={{ transform: `rotate(${currentStatus.earRotate}deg)`, transformOrigin: '35px 25px', transition: 'transform 0.4s ease-in-out' }}>
                        <path d="M 20 28 C 25 -5, 45 -5, 50 28 Z" fill="url(#botBodyGradient)" />
                        <path d="M 28 28 C 31 10, 39 10, 42 28 Z" fill="url(#innerEarGradient)" />
                    </g>
                    <g style={{ transform: `rotate(${-currentStatus.earRotate}deg)`, transformOrigin: '65px 25px', transition: 'transform 0.4s ease-in-out' }}>
                        <path d="M 80 28 C 75 -5, 55 -5, 50 28 Z" fill="url(#botBodyGradient)" />
                        <path d="M 72 28 C 69 10, 61 10, 58 28 Z" fill="url(#innerEarGradient)" />
                    </g>
                </g>

                <g style={{ transition: 'transform 0.3s ease-in-out', transform: `translateY(${currentStatus.eyeY}px)` }}>
                    <circle cx="38" cy="50" r="12" fill="white" />
                    <circle cx="62" cy="50" r="12" fill="white" />
                    <circle cx={38 + currentStatus.pupilX} cy={50 + currentStatus.pupilY} r="6" fill="#4338ca" />
                    <circle cx={62 + currentStatus.pupilX} cy={50 + currentStatus.pupilY} r="6" fill="#4338ca" />
                    {status !== 'incorrect' && <g>
                        <circle cx="43" cy="45" r="3.5" fill="white" fillOpacity="0.95" />
                        <circle cx="67" cy="45" r="3.5" fill="white" fillOpacity="0.95" />
                        <circle cx="36" cy="55" r="1.5" fill="white" fillOpacity="0.7" />
                        <circle cx="60" cy="55" r="1.5" fill="white" fillOpacity="0.7" />
                    </g>}
                </g>
                <path d="M 51.5 60 L 50 63 L 48.5 60 Z" fill="white" />
                <path d={currentStatus.mouth} stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" style={{ transition: 'd 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)' }} />

                <g stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
                    <path d="M 20 60 Q 30 62 38 60" fill="none" />
                    <path d="M 22 65 Q 32 67 40 65" fill="none" />
                    <path d="M 80 60 Q 70 62 62 60" fill="none" />
                    <path d="M 78 65 Q 68 67 60 65" fill="none" />
                </g>
            </svg>
        </div>
    );
}
