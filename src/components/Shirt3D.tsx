import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShirtData } from "@/context/useShirtData";
import * as THREE from "three";

type TexturePlacement = "front" | "back";

interface Shirt3DProps {
  imageUrl: string;
  texturePlacement: TexturePlacement;
}

export function Shirt3D({ imageUrl, texturePlacement }: Shirt3DProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const [targetRotation, setTargetRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const { shirtColor } = useShirtData();

  // Load the GLB model
  const { scene } = useGLTF("/oversized_t-shirt.glb");

  // Create a single instance of the shirt that we'll reuse
  const shirtScene = useMemo(() => {
    const cloned = scene.clone();

    // Remove any existing added geometries from the original
    const toRemove: THREE.Object3D[] = [];
    cloned.traverse(child => {
      if (
        child.userData.isAddedTexture ||
        child.name.includes("plane") ||
        child.name.includes("Plane") ||
        (child.type === "Mesh" &&
          (child as THREE.Mesh).geometry?.type === "PlaneGeometry")
      ) {
        toRemove.push(child);
      }
    });

    toRemove.forEach(obj => {
      if (obj.parent) {
        obj.parent.remove(obj);
      }
    });

    // Try to center the model by offsetting based on its bounding box
    const finalBox = new THREE.Box3().setFromObject(cloned);
    const finalCenter = finalBox.getCenter(new THREE.Vector3());

    // Offset the entire scene to center it at origin
    cloned.position.set(-finalCenter.x, -finalCenter.y, -finalCenter.z);

    return cloned;
  }, [scene]);

  // Create custom texture based on placement
  const customTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Set canvas size to higher resolution for better quality
    canvas.width = 2048;
    canvas.height = 2048;

    return new Promise<THREE.CanvasTexture>(resolve => {
      // Always start with a solid shirt color as the base
      ctx.fillStyle = shirtColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Create a temporary image to draw the design texture
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        // Enable high-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Ensure the generated image is drawn at full opacity on top
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;

        // Calculate image aspect ratio
        const imgAspectRatio = img.width / img.height;

        // Rotate context to fix 90-degree offset
        ctx.save();

        switch (texturePlacement) {
          case "front": {
            // Small patch on chest area - adjust position for front placement
            const maxSize = canvas.width * 0.2; // Scale with canvas size (20% of width)
            const frontX = canvas.width * 0.2; // Move toward left side of UV
            const frontY = canvas.height * 0.3; // Upper area

            // Calculate dimensions preserving aspect ratio
            let drawWidth = maxSize;
            let drawHeight = maxSize / imgAspectRatio;

            if (drawHeight > maxSize) {
              drawHeight = maxSize;
              drawWidth = maxSize * imgAspectRatio;
            }

            ctx.translate(frontX + maxSize / 2, frontY + maxSize / 2);
            ctx.rotate(Math.PI);
            ctx.scale(-1, 1); // Flip horizontally to fix mirroring
            ctx.drawImage(
              img,
              -drawWidth / 2,
              -drawHeight / 2,
              drawWidth,
              drawHeight,
            );
            break;
          }

          case "back": {
            // Small patch on back area - adjust position for back placement
            const maxSize = canvas.width * 0.2; // Scale with canvas size (20% of width)
            const backX = canvas.width * 0.84 - maxSize; // Move toward right side of UV
            const backY = canvas.height * 0.3; // Upper area

            // Calculate dimensions preserving aspect ratio
            let drawWidth = maxSize;
            let drawHeight = maxSize / imgAspectRatio;

            if (drawHeight > maxSize) {
              drawHeight = maxSize;
              drawWidth = maxSize * imgAspectRatio;
            }

            ctx.translate(backX + maxSize / 2, backY + maxSize / 2);
            ctx.rotate(Math.PI);
            ctx.scale(-1, 1); // Flip horizontally to fix mirroring
            ctx.drawImage(
              img,
              -drawWidth / 2,
              -drawHeight / 2,
              drawWidth,
              drawHeight,
            );
            break;
          }
        }

        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.flipY = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // Improve texture quality
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.anisotropy = Math.max(1, 4); // Improve quality at angles
        texture.generateMipmaps = true;
        texture.colorSpace = THREE.SRGBColorSpace;

        resolve(texture);
      };

      img.onerror = () => {
        // If image fails to load, create white texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.flipY = false;
        resolve(texture);
      };

      // Handle different image sources
      if (imageUrl.startsWith("data:")) {
        img.src = imageUrl;
      } else if (imageUrl.startsWith("/")) {
        img.src = imageUrl;
      } else {
        // For external URLs, we might need to handle CORS
        img.src = imageUrl;
      }
    });
  }, [imageUrl, texturePlacement, shirtColor]);

  // Smooth rotation animation
  useFrame((_, delta) => {
    if (groupRef.current && isAnimating) {
      const current = groupRef.current.rotation.y;
      const difference = targetRotation - current;

      // Normalize the difference to take the shortest path
      const normalizedDiff =
        (((difference % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) -
        Math.PI;

      const rotationSpeed = 4; // Adjust speed as needed
      const step = normalizedDiff * delta * rotationSpeed;

      if (Math.abs(normalizedDiff) < 0.01) {
        // Close enough, snap to target and stop animating
        groupRef.current.rotation.y = targetRotation;
        setIsAnimating(false);
      } else {
        groupRef.current.rotation.y += step;
      }
    }
  });

  // Position shirt based on texture placement mode with smooth transition
  useEffect(() => {
    if (groupRef.current) {
      let newTargetRotation = 0;

      switch (texturePlacement) {
        case "front":
          newTargetRotation = 0;
          break;
        case "back":
          newTargetRotation = Math.PI;
          break;
      }

      if (newTargetRotation !== targetRotation) {
        setTargetRotation(newTargetRotation);
        setIsAnimating(true);
      }
    }
  }, [texturePlacement, targetRotation]);

  // Apply the custom texture to the GLB model using useEffect to avoid multiple applications
  useEffect(() => {
    if (!shirtScene) return;

    const applyTexture = async () => {
      // Reset all materials to clean state first
      shirtScene.traverse(child => {
        if (child instanceof THREE.Mesh && child.material) {
          const mesh = child as THREE.Mesh<
            THREE.BufferGeometry,
            THREE.Material
          >;

          // Dispose of old material if it exists
          if (mesh.material && "dispose" in mesh.material) {
            (mesh.material as THREE.Material).dispose();
          }

          // Apply clean base material with selected shirt color
          mesh.material = new THREE.MeshStandardMaterial({
            color: shirtColor,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.DoubleSide,
          });
        }
      });

      // Apply texture if available
      if (customTexture) {
        const texture = await customTexture;
        shirtScene.traverse(child => {
          if (child instanceof THREE.Mesh && child.material) {
            const mesh = child as THREE.Mesh<
              THREE.BufferGeometry,
              THREE.Material
            >;

            // Dispose of old material
            if (mesh.material && "dispose" in mesh.material) {
              (mesh.material as THREE.Material).dispose();
            }

            // Apply textured material without color blending
            // The shirt color is already baked into the texture
            mesh.material = new THREE.MeshStandardMaterial({
              map: texture,
              color: "#ffffff", // Use white to avoid color multiplication
              roughness: 0.6,
              metalness: 0.0,
              transparent: false,
              side: THREE.DoubleSide,
            });
          }
        });
      }
    };

    applyTexture();
  }, [shirtScene, customTexture, texturePlacement, shirtColor]);

  return (
    <group ref={groupRef}>
      <primitive
        object={shirtScene}
        scale={[2.5, 2.5, 2.5]}
        position={[0, -3, 0]}
      />
    </group>
  );
}

// Preload the GLB model for better performance
useGLTF.preload("/oversized_t-shirt.glb");
