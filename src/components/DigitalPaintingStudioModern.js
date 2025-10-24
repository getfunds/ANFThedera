'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';
import styles from './DigitalPaintingStudioModern.module.css';

const FIXED_CANVAS_SIZE = { width: 1200, height: 800 };

export default function DigitalPaintingStudioModern({ onMintNFT, onListForSale }) {
  // Canvas refs
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const offscreenContextRef = useRef(null);
  
  // Painting state
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [brushSoftness, setBrushSoftness] = useState(0.7);
  const [brushOpacity, setBrushOpacity] = useState(1.0);
  const [brushType, setBrushType] = useState('calligraphy');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentPath, setCurrentPath] = useState([]);
  
  // History for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Mouse tracking
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showBrushCursor, setShowBrushCursor] = useState(false);
  
  // Performance refs
  const lastDrawTime = useRef(0);
  const animationFrameRef = useRef(null);
  
  // Canvas size state
  const [canvasSize] = useState(FIXED_CANVAS_SIZE);
  
  // Color palette
  const [customPalette, setCustomPalette] = useState([
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
  ]);

  // Save canvas state to history
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !contextRef.current) return;
    
    const imageData = contextRef.current.getImageData(0, 0, canvas.width, canvas.height);
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      return newHistory.slice(-50); // Keep last 50 states
    });
    
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    
    // Configure context for smooth rendering
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    
    contextRef.current = context;
    
    // Create offscreen canvas for advanced effects
    const offscreenCanvas = new OffscreenCanvas(canvasSize.width, canvasSize.height);
    const offscreenContext = offscreenCanvas.getContext('2d');
    offscreenCanvasRef.current = offscreenCanvas;
    offscreenContextRef.current = offscreenContext;
    
    // Initialize with white background
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Save initial state
    saveToHistory();
  }, [canvasSize, saveToHistory]);

  // Undo function
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      const imageData = history[historyIndex - 1];
      
      context.putImageData(imageData, 0, 0);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  // Redo function
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      const imageData = history[historyIndex + 1];
      
      context.putImageData(imageData, 0, 0);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  // Get precise mouse/touch position relative to canvas
  const getCanvasPosition = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    // Map screen coords to canvas coords using scale factors
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    
    const canvasX = offsetX * scaleX;
    const canvasY = offsetY * scaleY;
    
    return {
      x: canvasX,
      y: canvasY,
      screenX: offsetX,
      screenY: offsetY
    };
  }, []);

  // Update mouse position for cursor tracking
  const updateMousePosition = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    // Use raw screen coordinates relative to canvas for cursor positioning
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    
    setMousePos({ 
      x: screenX, 
      y: screenY 
    });
  }, []);

  // Utilities
  const hexToRgb = useCallback((hex) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) {
      return [0, 0, 0];
    }
    if (hex.length === 4) {
      const r = parseInt(hex[1] + hex[1], 16);
      const g = parseInt(hex[2] + hex[2], 16);
      const b = parseInt(hex[3] + hex[3], 16);
      return [r, g, b];
    }
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
  }, []);

  // Realistic brush rendering with bristles, texture, and advanced dynamics (generic)
  const drawRealisticBrush = useCallback((context, startPoint, endPoint, color, size, opacity, softness) => {
    // Calculate stroke dynamics
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = distance;
    
    // Pressure variation
    const avgPressure = (startPoint.pressure + endPoint.pressure) / 2;
    
    // Speed-based width variation
    const maxSpeed = 50;
    const speedFactor = Math.max(0.3, Math.min(1.0, 1 - (speed / maxSpeed)));
    const dynamicSize = size * avgPressure * speedFactor;
    
    // Parse color for RGB manipulation
    const rgb = color.startsWith('#') ? 
      [
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16)
      ] : [0, 0, 0];
    
    context.save();
    
    // Create bristle effect
    const bristleCount = Math.floor(dynamicSize * 0.3) + 3;
    const bristleSpread = dynamicSize * 0.4;
    
    for (let i = 0; i < bristleCount; i++) {
      // Calculate bristle position with jitter
      const angle = (i / bristleCount) * Math.PI * 2;
      const bristleRadius = (Math.random() * bristleSpread) * (0.5 + Math.random() * 0.5);
      const bristleJitterX = Math.cos(angle) * bristleRadius + (Math.random() - 0.5) * 2;
      const bristleJitterY = Math.sin(angle) * bristleRadius + (Math.random() - 0.5) * 2;
      
      // Individual bristle properties
      const bristleOpacity = opacity * softness * (0.3 + Math.random() * 0.7) * avgPressure;
      const bristleWidth = (dynamicSize * 0.1) + Math.random() * (dynamicSize * 0.15);
      
      // Color variation for texture
      const colorVariation = 0.1;
      const r = Math.max(0, Math.min(255, rgb[0] + (Math.random() - 0.5) * 255 * colorVariation));
      const g = Math.max(0, Math.min(255, rgb[1] + (Math.random() - 0.5) * 255 * colorVariation));
      const b = Math.max(0, Math.min(255, rgb[2] + (Math.random() - 0.5) * 255 * colorVariation));
      
      // Draw individual bristle
      context.globalAlpha = bristleOpacity;
      context.strokeStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
      context.lineWidth = bristleWidth;
      
      // Add texture with slight path variation
      const pathVariation = 0.5;
      const startX = startPoint.x + bristleJitterX + (Math.random() - 0.5) * pathVariation;
      const startY = startPoint.y + bristleJitterY + (Math.random() - 0.5) * pathVariation;
      const endX = endPoint.x + bristleJitterX + (Math.random() - 0.5) * pathVariation;
      const endY = endPoint.y + bristleJitterY + (Math.random() - 0.5) * pathVariation;
      
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      context.stroke();
    }
    
    // Add central stroke for consistency
    context.globalAlpha = opacity * softness * avgPressure * 0.8;
    context.strokeStyle = color;
    context.lineWidth = dynamicSize;
    context.shadowColor = color;
    context.shadowBlur = softness * 3;
    
    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();
    
    // Add paint flow effect for wet brush simulation
    if (softness > 0.5) {
      const flowParticles = Math.floor(dynamicSize * 0.2);
      context.globalAlpha = opacity * 0.1;
      
      for (let i = 0; i < flowParticles; i++) {
        const flowX = startPoint.x + dx * Math.random() + (Math.random() - 0.5) * dynamicSize;
        const flowY = startPoint.y + dy * Math.random() + (Math.random() - 0.5) * dynamicSize;
        const flowSize = Math.random() * 3 + 1;
        
        context.fillStyle = color;
        context.beginPath();
        context.arc(flowX, flowY, flowSize, 0, Math.PI * 2);
        context.fill();
      }
    }
    
    context.restore();
  }, []);

  // Paint-like brushes
  // Original first brush using perfect-freehand
  const drawCalligraphySegment = useCallback((context, points, color, size, opacity, softness) => {
    // Use perfect-freehand library with brush configuration (original approach)
    const strokeOptions = {
      size: size,
      thinning: softness * 0.8,
      smoothing: 0.7,
      streamline: 0.3,
      easing: (t) => Math.sin(t * Math.PI * 0.5),
      start: { taper: true, easing: (t) => t, cap: true },
      end: { taper: true, easing: (t) => t, cap: true },
    };

    // Convert points to perfect-freehand format
    const freehandPoints = points.map(p => [p.x, p.y, p.pressure]);
    
    // Create stroke using perfect-freehand
    const stroke = getStroke(freehandPoints, strokeOptions);
    
    if (stroke.length < 2) return;

    context.save();
    
    // Brush: Soft, textured strokes with blending (original settings)
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = opacity * softness;
    context.fillStyle = color;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowColor = color;
    context.shadowBlur = softness * 2;

    // Create path from stroke points and fill
    context.beginPath();
    context.moveTo(stroke[0][0], stroke[0][1]);
    
    for (let i = 1; i < stroke.length; i++) {
      const [x, y] = stroke[i];
      context.lineTo(x, y);
    }
    
    context.closePath();
    context.fill();
    
    context.restore();
  }, []);

  const drawCrayonSegment = useCallback((context, startPoint, endPoint, color, size, opacity) => {
    // Grainy stroke constructed from stippled particles distributed across the stroke width
    const particles = Math.max(8, Math.floor(size * 1.5));
    const rgb = hexToRgb(color);
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const segLen = Math.hypot(dx, dy) || 1;
    const nx = -dy / segLen; // unit normal
    const ny = dx / segLen;

    context.save();
    context.globalCompositeOperation = 'source-over';

    for (let i = 0; i < particles; i++) {
      const t = Math.random();
      const cx = startPoint.x + dx * t;
      const cy = startPoint.y + dy * t;
      // Scatter across width with more density near edges
      const radial = (Math.random() - 0.5) * size * (0.9 + Math.random() * 0.2);
      const jitterX = cx + nx * radial + (Math.random() - 0.5) * 1.2;
      const jitterY = cy + ny * radial + (Math.random() - 0.5) * 1.2;
      const dotSize = 0.7 + Math.random() * Math.max(1.5, size * 0.08);
      const a = (0.35 + Math.random() * 0.45) * opacity; // grainy alpha
      context.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
      context.beginPath();
      context.arc(jitterX, jitterY, dotSize, 0, Math.PI * 2);
      context.fill();
    }

    // Light blending pass to unify grains
    context.globalAlpha = Math.min(0.2, 0.05 + opacity * 0.12);
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, size * 0.4);
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();

    context.restore();
  }, [hexToRgb]);

  const drawWatercolorSegment = useCallback((context, startPoint, endPoint, color, size, opacity, softness) => {
    // Translucent, soft stroke with edge darkening using multiply blending
    const width = Math.max(1, size * (1.0 + 0.1 * softness));
    context.save();

    // Broad wash
    context.globalCompositeOperation = 'multiply';
    context.globalAlpha = Math.min(0.22, 0.08 + opacity * 0.18);
    context.strokeStyle = color;
    context.lineWidth = width * 1.15;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowColor = color;
    context.shadowBlur = width * (0.35 + 0.25 * softness);
    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();

    // Edge darkening (capillary effect)
    context.shadowBlur = 0;
    context.globalAlpha = Math.min(0.25, 0.06 + opacity * 0.12);
    context.lineWidth = width * 1.05;
    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();

    // Subtle inner pass to keep center soft
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = Math.min(0.15, 0.05 + opacity * 0.1);
    context.lineWidth = width * 0.7;
    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();

    context.restore();
  }, []);

  // Airbrush tool functionality
  const drawAirbrushStroke = useCallback((points) => {
    if (points.length < 1) return;
    
    const context = contextRef.current;
    context.save();
    
    points.forEach((point) => {
      const sprayRadius = brushSize;
      const particleCount = Math.floor(brushSize * 0.8);
      const opacity = brushOpacity * 0.1;
      
      const color = currentColor;
      const rgb = color.startsWith('#') ? 
        [
          parseInt(color.slice(1, 3), 16),
          parseInt(color.slice(3, 5), 16),
          parseInt(color.slice(5, 7), 16)
        ] : [0, 0, 0];
      
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = opacity;
      
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * Math.random() * sprayRadius;
        
        const particleX = point.x + Math.cos(angle) * distance;
        const particleY = point.y + Math.sin(angle) * distance;
        
        const particleSize = Math.random() * 2 + 0.5;
        
        context.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.random() * 0.8 + 0.2})`;
        context.beginPath();
        context.arc(particleX, particleY, particleSize, 0, Math.PI * 2);
        context.fill();
      }
    });
    
    context.restore();
  }, [brushSize, brushOpacity, currentColor]);


  // Handle drawing start
  const startDrawing = useCallback((e) => {
    e.preventDefault();
    const pos = getCanvasPosition(e);
    
    setIsDrawing(true);
    setCurrentPath([{
      x: pos.x,
      y: pos.y,
      pressure: e.pressure || 0.5
    }]);
  }, [getCanvasPosition]);

  // Optimized drawing with incremental rendering
  const draw = useCallback((e) => {
    updateMousePosition(e);
    
    if (!isDrawing) return;
    
    e.preventDefault();
    
    // Throttle drawing for performance
    const now = performance.now();
    const minFrameMs = 8; // ~120fps
    if (now - lastDrawTime.current < minFrameMs) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(() => draw(e));
      return;
    }
    lastDrawTime.current = now;
    
    const pos = getCanvasPosition(e);
    
    const newPoint = {
      x: pos.x,
      y: pos.y,
      pressure: e.pressure || 0.5
    };
    
    setCurrentPath(prev => {
      const updatedPath = [...prev, newPoint];
      
      // Handle different tools
      if (tool === 'airbrush') {
        drawAirbrushStroke([newPoint]);
      } else {
        // For brush-based tools
        if (updatedPath.length >= 2) {
          const lastPoint = updatedPath[updatedPath.length - 1];
          const prevPoint = updatedPath[updatedPath.length - 2];
          
          // Handle tool-specific drawing
          if (tool === 'brush') {
            // Route to selected Paint-like brush variant
            if (brushType === 'calligraphy') {
              // Calligraphy uses the full path for perfect-freehand
              // Clear and redraw on offscreen canvas to prevent overlapping fills
              const offscreenCanvas = offscreenCanvasRef.current;
              const offscreenContext = offscreenContextRef.current;
              
              // Get the last saved state from history
              const imageData = history[historyIndex];
              if (imageData && imageData.data && imageData.data.length > 0) {
                offscreenContext.putImageData(imageData, 0, 0);
              } else {
                offscreenContext.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
                offscreenContext.fillStyle = '#FFFFFF';
                offscreenContext.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
              }
              
              // Draw the complete stroke on offscreen canvas
              drawCalligraphySegment(offscreenContext, updatedPath, currentColor, brushSize, brushOpacity, brushSoftness);
              
              // Copy to main canvas
              const mainContext = contextRef.current;
              mainContext.clearRect(0, 0, canvasSize.width, canvasSize.height);
              mainContext.drawImage(offscreenCanvas, 0, 0);
            } else if (brushType === 'crayon') {
              drawCrayonSegment(contextRef.current, prevPoint, lastPoint, currentColor, brushSize, brushOpacity);
            } else if (brushType === 'watercolour') {
              drawWatercolorSegment(contextRef.current, prevPoint, lastPoint, currentColor, brushSize, brushOpacity, brushSoftness);
            } else {
              // fallback to generic realistic brush
              drawRealisticBrush(contextRef.current, prevPoint, lastPoint, currentColor, brushSize, brushOpacity, brushSoftness);
            }
          } else {
            // Standard line drawing for other tools
            const context = contextRef.current;
            context.save();
            
            switch (tool) {
              case 'pencil':
                context.globalCompositeOperation = 'source-over';
                context.globalAlpha = Math.min(brushOpacity * 1.2, 1.0);
                context.strokeStyle = currentColor;
                context.lineWidth = Math.max(1, brushSize * 0.4);
                context.lineCap = 'round';
                context.lineJoin = 'round';
                context.shadowColor = currentColor;
                context.shadowBlur = 0.5;
                break;
                
              case 'pen':
                context.globalCompositeOperation = 'source-over';
                context.globalAlpha = brushOpacity;
                context.strokeStyle = currentColor;
                context.lineWidth = brushSize;
                context.lineCap = 'round';
                context.lineJoin = 'round';
                break;
                
              case 'eraser':
                context.globalCompositeOperation = 'destination-out';
                context.globalAlpha = brushOpacity;
                context.strokeStyle = '#000000';
                context.lineWidth = brushSize;
                context.lineCap = 'round';
                context.lineJoin = 'round';
                break;
                
              default:
                context.globalCompositeOperation = 'source-over';
                context.globalAlpha = brushOpacity;
                context.strokeStyle = currentColor;
                context.lineWidth = brushSize;
                context.lineCap = 'round';
                context.lineJoin = 'round';
                break;
            }
            
            context.beginPath();
            context.moveTo(prevPoint.x, prevPoint.y);
            context.lineTo(lastPoint.x, lastPoint.y);
            context.stroke();
            
            context.restore();
          }
        }
      }
      
      return updatedPath;
    });
  }, [isDrawing, getCanvasPosition, updateMousePosition, drawAirbrushStroke, drawCalligraphySegment, drawCrayonSegment, drawWatercolorSegment, drawRealisticBrush, currentColor, brushOpacity, tool, brushSize, brushSoftness, history, historyIndex, canvasSize]);

  // Handle drawing end
  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    setCurrentPath([]);
    
    // Save to history after completing stroke
    setTimeout(() => {
      saveToHistory();
    }, 10);
  }, [isDrawing, saveToHistory]);

  // Handle mouse enter/leave for cursor visibility
  const handleMouseEnter = useCallback(() => {
    setShowBrushCursor(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowBrushCursor(false);
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const context = contextRef.current;
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvasSize.width, canvasSize.height);
    saveToHistory();
  }, [canvasSize, saveToHistory]);

  // Export canvas
  const exportCanvas = useCallback((format = 'png') => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `artwork.${format}`;
    link.href = canvas.toDataURL(`image/${format}`);
    link.click();
  }, []);

  // Handle NFT minting
  const handleMintAsNFT = useCallback(() => {
    if (onMintNFT) {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      onMintNFT(imageData);
    }
  }, [onMintNFT]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === 'z' && e.shiftKey || e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className={styles.modernPaintingStudio}>
      {/* Top Navigation Bar */}
      <nav className={styles.topNavbar}>
        <div className={styles.navLeft}>
          <h1 className={styles.appTitle}>🎨 Digital Art Studio</h1>
        </div>
        
        <div className={styles.navCenter}>
          {/* Tool Selection */}
          <div className={styles.toolNavigation}>
            <button 
              className={`${styles.navToolButton} ${tool === 'brush' ? styles.active : ''}`}
              onClick={() => setTool('brush')}
              title="Realistic Brush"
            >
              <span className={styles.toolIcon}>🖌️</span>
              <span className={styles.toolLabel}>Brush</span>
            </button>
            <button 
              className={`${styles.navToolButton} ${tool === 'pencil' ? styles.active : ''}`}
              onClick={() => setTool('pencil')}
              title="Sharp Pencil"
            >
              <span className={styles.toolIcon}>✏️</span>
              <span className={styles.toolLabel}>Pencil</span>
            </button>
            <button 
              className={`${styles.navToolButton} ${tool === 'pen' ? styles.active : ''}`}
              onClick={() => setTool('pen')}
              title="Ink Pen"
            >
              <span className={styles.toolIcon}>🖊️</span>
              <span className={styles.toolLabel}>Pen</span>
            </button>
            <button 
              className={`${styles.navToolButton} ${tool === 'eraser' ? styles.active : ''}`}
              onClick={() => setTool('eraser')}
              title="Eraser"
            >
              <span className={styles.toolIcon}>🧽</span>
              <span className={styles.toolLabel}>Eraser</span>
            </button>
            <button 
              className={`${styles.navToolButton} ${tool === 'airbrush' ? styles.active : ''}`}
              onClick={() => setTool('airbrush')}
              title="Airbrush"
            >
              <span className={styles.toolIcon}>💨</span>
              <span className={styles.toolLabel}>Airbrush</span>
            </button>
          </div>
        </div>
        
        <div className={styles.navRight}>
          {/* Quick Actions */}
          <button onClick={undo} disabled={historyIndex <= 0} className={styles.quickAction} title="Undo">
            ↶
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className={styles.quickAction} title="Redo">
            ↷
          </button>
          <button onClick={clearCanvas} className={styles.quickAction} title="Clear Canvas">
            🗑️
          </button>
          <button onClick={handleMintAsNFT} className={styles.mintButton} title="Mint as NFT">
            🎨 Mint NFT
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Dynamic Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarContent}>
            <h3 className={styles.sidebarTitle}>
              {tool === 'brush' && '🖌️ Brush Settings'}
              {tool === 'pencil' && '✏️ Pencil Settings'}
              {tool === 'pen' && '🖊️ Pen Settings'}
              {tool === 'eraser' && '🧽 Eraser Settings'}
              {tool === 'airbrush' && '💨 Airbrush Settings'}
            </h3>
            
            {/* Tool-Specific Settings */}
            <div className={styles.toolSettings}>
              {/* Size Setting (All Tools) */}
              <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>
                  Size: <span className={styles.settingValue}>{brushSize}px</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className={styles.modernSlider}
                />
              </div>

              {/* Opacity Setting (All Tools) */}
              <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>
                  Opacity: <span className={styles.settingValue}>{Math.round(brushOpacity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={brushOpacity}
                  onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
                  className={styles.modernSlider}
                />
              </div>

              {/* Brush-Specific Settings */}
              {tool === 'brush' && (
                <>
                  <div className={styles.settingGroup}>
                    <label className={styles.settingLabel}>
                      Softness: <span className={styles.settingValue}>{Math.round(brushSoftness * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={brushSoftness}
                      onChange={(e) => setBrushSoftness(parseFloat(e.target.value))}
                      className={styles.modernSlider}
                    />
                  </div>
                  
                  <div className={styles.settingGroup}>
                    <label className={styles.settingLabel}>Brush Type</label>
                    <select 
                      value={brushType} 
                      onChange={(e) => setBrushType(e.target.value)}
                      className={styles.modernSelect}
                    >
                      <option value="calligraphy">Calligraphy</option>
                      <option value="crayon">Crayon</option>
                      <option value="watercolour">Watercolour</option>
                    </select>
                  </div>
                </>
              )}

              {/* Airbrush-Specific Settings */}
              {tool === 'airbrush' && (
                <div className={styles.toolDescription}>
                  <p>💨 Creates soft spray patterns perfect for gradients, shading, and smooth color transitions.</p>
                </div>
              )}
            </div>

            {/* Color Picker */}
            <div className={styles.colorSection}>
              <h4 className={styles.sectionTitle}>Color</h4>
              
              <div className={styles.modernColorPicker}>
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => setCurrentColor(e.target.value)}
                  className={styles.modernColorInput}
                />
                <div className={styles.colorPreview} style={{ backgroundColor: currentColor }}></div>
              </div>
              
              <div className={styles.colorPalette}>
                {customPalette.map((color, index) => (
                  <button
                    key={index}
                    className={`${styles.paletteColor} ${currentColor === color ? styles.selected : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCurrentColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>

          </div>
        </aside>

        {/* Canvas Area */}
        <main className={styles.canvasArea}>
          <div className={styles.canvasWrapper}>
            <canvas
              ref={canvasRef}
              width={FIXED_CANVAS_SIZE.width}
              height={FIXED_CANVAS_SIZE.height}
              className={styles.modernCanvas}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onMouseEnter={handleMouseEnter}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ 
                cursor: 'none',
                touchAction: 'none'
              }}
            />
            
            {/* Custom Tool Cursors */}
            {showBrushCursor && (
              <>
                {/* Standard brush/pencil/pen cursor */}
                {(tool === 'brush' || tool === 'pencil' || tool === 'pen' || tool === 'eraser') && (
                  <div 
                    className={styles.brushCursor}
                    style={{
                      left: mousePos.x - (tool === 'pencil' ? Math.max(4, brushSize * 0.4) : brushSize) / 2 - 2,
                      top: mousePos.y - (tool === 'pencil' ? Math.max(4, brushSize * 0.4) : brushSize) / 2 - 2,
                      width: tool === 'pencil' ? Math.max(4, brushSize * 0.4) : brushSize,
                      height: tool === 'pencil' ? Math.max(4, brushSize * 0.4) : brushSize,
                      borderRadius: '50%',
                      borderColor: 
                        tool === 'eraser' ? '#ff0000' : 
                        tool === 'pencil' ? '#666666' :
                        tool === 'pen' ? '#000000' :
                        currentColor,
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      background: 'transparent',
                      opacity: 1.0,
                      pointerEvents: 'none',
                      zIndex: 1000,
                    }}
                  />
                )}
                
                {/* Airbrush cursor */}
                {tool === 'airbrush' && (
                  <>
                    <div 
                      className={styles.airbrushCursor}
                      style={{
                        left: mousePos.x - brushSize - 2,
                        top: mousePos.y - brushSize - 2,
                        width: brushSize * 2,
                        height: brushSize * 2,
                        borderRadius: '50%',
                        border: '2px dashed rgba(255, 255, 255, 0.8)',
                        background: `radial-gradient(circle, ${currentColor}20 0%, transparent 70%)`,
                        pointerEvents: 'none',
                        zIndex: 999,
                      }}
                    />
                    <div 
                      className={styles.airbrushCenter}
                      style={{
                        left: mousePos.x - 2,
                        top: mousePos.y - 2,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        backgroundColor: currentColor,
                        pointerEvents: 'none',
                        zIndex: 1001,
                      }}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
