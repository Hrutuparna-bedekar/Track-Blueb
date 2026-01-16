import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Shield, Eye, Users } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

function Landing() {
    const [currentSlide, setCurrentSlide] = useState(0)
    const { t } = useLanguage()

    // PPE images for carousel
    const slides = [
        {
            id: 1,
            image: '/ppe1.jpg',
            title: t('Real-time Detection'),
            description: t('YOLO-powered detection identifies PPE compliance in real-time')
        },
        {
            id: 2,
            image: '/ppe2.jpg',
            title: t('Individual Tracking'),
            description: t('Deep SORT tracking maintains identity across video frames')
        },
        {
            id: 3,
            image: '/ppe3.jpg',
            title: t('Compliance Reports'),
            description: t('Comprehensive reports for safety audits and compliance')
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
                        {t('Safety compliance,')}
                        <br />
                        <span className="hero-title-italic">{t('reimagined')}</span>
                    </h1>

                    <p className="hero-description">
                        {t('Automatically detect PPE violations, track individuals across video feeds, and generate actionable compliance reports — all powered by advanced computer vision.')}
                    </p>

                    <div className="hero-cta">
                        <Link to="/dashboard" className="btn btn-primary btn-lg">
                            {t('Open Dashboard')} <ArrowRight size={18} />
                        </Link>
                        <Link to="/videos" className="btn btn-secondary btn-lg">
                            {t('Upload Video')}
                        </Link>
                    </div>

                    {/* Feature Pills */}
                    <div className="hero-features">
                        <div className="hero-feature">
                            <Shield size={16} />
                            <span>{t('PPE Detection')}</span>
                        </div>
                        <div className="hero-feature">
                            <Eye size={16} />
                            <span>{t('Real-time Monitoring')}</span>
                        </div>
                        <div className="hero-feature">
                            <Users size={16} />
                            <span>{t('Individual Tracking')}</span>
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
