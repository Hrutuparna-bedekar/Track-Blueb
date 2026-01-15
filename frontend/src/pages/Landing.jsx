import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Shield, Eye, Users } from 'lucide-react'

function Landing() {
    const [currentSlide, setCurrentSlide] = useState(0)

    // PPE images for carousel
    const slides = [
        {
            id: 1,
            image: '/ppe1.jpg',
            title: 'Real-time Detection',
            description: 'YOLO-powered detection identifies PPE compliance in real-time'
        },
        {
            id: 2,
            image: '/ppe2.jpg',
            title: 'Individual Tracking',
            description: 'Deep SORT tracking maintains identity across video frames'
        },
        {
            id: 3,
            image: '/ppe3.jpg',
            title: 'Compliance Reports',
            description: 'Comprehensive reports for safety audits and compliance'
        }
    ]

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length)
        }, 4000)
        return () => clearInterval(timer)
    }, [slides.length])

    return (
        <section className="landing-hero">
            <div className="hero-content">
                {/* Text Content */}
                <div className="hero-text">
                    <div className="hero-badge">
                        <span className="hero-badge-dot"></span>
                        AI-Powered Analytics
                    </div>

                    <h1 className="hero-title">
                        Safety compliance,
                        <br />
                        <span className="hero-title-italic">reimagined</span>
                    </h1>

                    <p className="hero-description">
                        Automatically detect PPE violations, track individuals across video feeds,
                        and generate actionable compliance reports — all powered by advanced computer vision.
                    </p>

                    <div className="hero-cta">
                        <Link to="/dashboard" className="btn btn-primary btn-lg">
                            Open Dashboard <ArrowRight size={18} />
                        </Link>
                        <Link to="/videos" className="btn btn-secondary btn-lg">
                            Upload Video
                        </Link>
                    </div>

                    {/* Feature Pills */}
                    <div className="hero-features">
                        <div className="hero-feature">
                            <Shield size={16} />
                            <span>PPE Detection</span>
                        </div>
                        <div className="hero-feature">
                            <Eye size={16} />
                            <span>Real-time Monitoring</span>
                        </div>
                        <div className="hero-feature">
                            <Users size={16} />
                            <span>Individual Tracking</span>
                        </div>
                    </div>
                </div>

                {/* Carousel with Images */}
                <div className="carousel">
                    {slides.map((slide, index) => (
                        <div
                            key={slide.id}
                            className={`carousel-slide ${index === currentSlide ? 'active' : ''}`}
                        >
                            <img
                                src={slide.image}
                                alt={slide.title}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                            <div className="carousel-caption">
                                <h3>{slide.title}</h3>
                                <p>{slide.description}</p>
                            </div>
                        </div>
                    ))}

                    <div className="carousel-dots">
                        {slides.map((_, index) => (
                            <button
                                key={index}
                                className={`carousel-dot ${index === currentSlide ? 'active' : ''}`}
                                onClick={() => setCurrentSlide(index)}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Landing
