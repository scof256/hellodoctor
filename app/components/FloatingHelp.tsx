'use client';

import React, { useState } from 'react';

export interface HelpContent {
  title: string;
  description: string;
  steps?: string[];
  screenshot?: string;
  videoUrl?: string;
  contactOptions: {
    phone?: string;
    whatsapp?: string;
    email?: string;
  };
}

interface FloatingHelpProps {
  contextId: string;
  position?: 'bottom-right' | 'bottom-left';
  helpContent?: HelpContent;
}

export function FloatingHelp({
  contextId,
  position = 'bottom-right',
  helpContent,
}: FloatingHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleContactPhone = () => {
    if (helpContent?.contactOptions.phone) {
      window.location.href = `tel:${helpContent.contactOptions.phone}`;
    }
  };

  const handleContactWhatsApp = () => {
    if (helpContent?.contactOptions.whatsapp) {
      window.open(`https://wa.me/${helpContent.contactOptions.whatsapp}`, '_blank');
    }
  };

  const handleContactEmail = () => {
    if (helpContent?.contactOptions.email) {
      window.location.href = `mailto:${helpContent.contactOptions.email}`;
    }
  };

  const positionStyles = position === 'bottom-right'
    ? { bottom: '16px', right: '16px' }
    : { bottom: '16px', left: '16px' };

  return (
    <>
      {/* Floating Help Button */}
      <button
        onClick={handleToggle}
        className="floating-help-button"
        aria-label="Get help"
        data-context-id={contextId}
        style={{
          position: 'fixed',
          ...positionStyles,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#0088CC',
          color: '#FFFFFF',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }}
      >
        ?
      </button>

      {/* Help Content Bottom Sheet */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={handleClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1001,
              animation: 'fadeIn 0.3s ease',
            }}
          />

          {/* Bottom Sheet */}
          <div
            className="help-bottom-sheet"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              maxHeight: '80vh',
              overflowY: 'auto',
              zIndex: 1002,
              animation: 'slideUp 0.3s ease',
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid #E5E7EB',
              }}
            >
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#1F2937',
                  margin: 0,
                }}
              >
                {helpContent?.title || 'Help'}
              </h2>
              <button
                onClick={handleClose}
                aria-label="Close help"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#F3F4F6',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  color: '#6B7280',
                }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '24px' }}>
              {/* Description */}
              {helpContent?.description && (
                <p
                  style={{
                    fontSize: '16px',
                    color: '#4B5563',
                    lineHeight: '1.6',
                    marginBottom: '24px',
                  }}
                >
                  {helpContent.description}
                </p>
              )}

              {/* Steps */}
              {helpContent?.steps && helpContent.steps.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '12px',
                    }}
                  >
                    Steps:
                  </h3>
                  <ol
                    style={{
                      paddingLeft: '24px',
                      margin: 0,
                    }}
                  >
                    {helpContent.steps.map((step, index) => (
                      <li
                        key={index}
                        style={{
                          fontSize: '16px',
                          color: '#4B5563',
                          lineHeight: '1.6',
                          marginBottom: '8px',
                        }}
                      >
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Screenshot */}
              {helpContent?.screenshot && (
                <div style={{ marginBottom: '24px' }}>
                  <img
                    src={helpContent.screenshot}
                    alt="Help screenshot"
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                    }}
                  />
                </div>
              )}

              {/* Video */}
              {helpContent?.videoUrl && (
                <div style={{ marginBottom: '24px' }}>
                  <video
                    src={helpContent.videoUrl}
                    controls
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                    }}
                  />
                </div>
              )}

              {/* Contact Options */}
              {helpContent?.contactOptions && (
                <div>
                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '12px',
                    }}
                  >
                    Need more help?
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {helpContent.contactOptions.phone && (
                      <button
                        onClick={handleContactPhone}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '16px',
                          backgroundColor: '#F3F4F6',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1F2937',
                          transition: 'background-color 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#E5E7EB';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#F3F4F6';
                        }}
                      >
                        <span style={{ fontSize: '24px' }}>📞</span>
                        <span>Call Support</span>
                      </button>
                    )}

                    {helpContent.contactOptions.whatsapp && (
                      <button
                        onClick={handleContactWhatsApp}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '16px',
                          backgroundColor: '#25D366',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#FFFFFF',
                          transition: 'background-color 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#1EBE57';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#25D366';
                        }}
                      >
                        <span style={{ fontSize: '24px' }}>💬</span>
                        <span>WhatsApp Support</span>
                      </button>
                    )}

                    {helpContent.contactOptions.email && (
                      <button
                        onClick={handleContactEmail}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '16px',
                          backgroundColor: '#F3F4F6',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1F2937',
                          transition: 'background-color 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#E5E7EB';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#F3F4F6';
                        }}
                      >
                        <span style={{ fontSize: '24px' }}>📧</span>
                        <span>Email Support</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Animations */}
          <style jsx>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }

            @keyframes slideUp {
              from {
                transform: translateY(100%);
              }
              to {
                transform: translateY(0);
              }
            }
          `}</style>
        </>
      )}
    </>
  );
}
