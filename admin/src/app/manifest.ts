import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
 return { name: 'VfixurPC Operations', short_name: 'VfixurPC', start_url: '/dashboard', display: 'standalone', background_color: '#ffffff', theme_color: '#1B2A3B', icons: [{src:'/app-icon.png',sizes:'256x256',type:'image/png',purpose:'any'}] };
}
